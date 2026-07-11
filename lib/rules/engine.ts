"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";

export type FactorResult = { code: string; raw: number; weight: number; weighted: number };
export type EvaluationResult = {
  ok: boolean;
  error?: string;
  score?: number;
  decision?: string;
  factors?: FactorResult[];
  explanation?: string;
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Evalua un incidente con la regla de transformacion activa (config-driven).
 * Calcula factores, aplica pesos, decide por umbrales, persiste rule_evaluation
 * (auditado en ledger), actualiza el incidente y crea project_recommendation si aplica.
 * La decision final de prioridad la toma el RC (area de negocio), no el motor.
 */
export async function evaluateIncident(incidentId: string): Promise<EvaluationResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };
  const supabase = ctx.supabase;

  const { data: inc } = await supabase
    .from("incident")
    .select("*, ci:affected_ci_id(criticality), service:affected_service_id(criticality)")
    .eq("id", incidentId)
    .maybeSingle();
  if (!inc) return { ok: false, error: "not_found" };

  const { data: rule } = await supabase
    .from("rule")
    .select("id, code, name")
    .eq("rule_type", "transformation")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!rule) return { ok: false, error: "no_active_rule" };

  const { data: rv } = await supabase
    .from("rule_version")
    .select("*")
    .eq("rule_id", rule.id)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!rv) return { ok: false, error: "no_published_version" };

  const weights = (rv.weights_json ?? {}) as Record<string, number>;
  const thresholds = (rv.thresholds_json ?? {}) as Record<string, number>;
  const expr = (rv.expression_json ?? {}) as Record<string, Record<string, number>>;

  // Recurrencia: incidentes sobre la misma aplicacion en la ventana configurada.
  let recurrence = 0;
  if (inc.affected_ci_id) {
    const windowDays = expr.frequency_recurrence?.windowDays ?? 30;
    const since = new Date(Date.now() - windowDays * 86400000).toISOString();
    const { count } = await supabase
      .from("incident")
      .select("*", { count: "exact", head: true })
      .eq("affected_ci_id", inc.affected_ci_id)
      .gte("opened_at", since);
    recurrence = count ?? 0;
  }

  const critMap = expr.critical_service ?? { critical: 100, high: 70, medium: 40, low: 10 };
  const critLevel =
    (inc.ci as { criticality?: string } | null)?.criticality ??
    (inc.service as { criticality?: string } | null)?.criticality ??
    "medium";
  const meta = (inc.metadata ?? {}) as Record<string, number>;

  const factors: FactorResult[] = [];
  const add = (code: string, raw: number) => {
    const w = weights[code] ?? 0;
    const r = clamp(raw);
    factors.push({ code, raw: r, weight: w, weighted: r * w });
  };

  add("financial_impact", (Number(inc.financial_impact_estimate) / (expr.financial_impact?.max ?? 2000000)) * 100);
  add("frequency_recurrence", (recurrence / (expr.frequency_recurrence?.max ?? 10)) * 100);
  add("critical_service", (critMap as Record<string, number>)[critLevel] ?? 40);
  add("partner_impact", inc.partner_impact ? 100 : (inc.affected_partner_count / (expr.partner_impact?.max ?? 5)) * 100);
  add("data_quality", inc.data_quality_suspected ? 100 : 0);
  add("security_risk", inc.security_suspected ? 100 : 0);
  add("manual_workaround", Number(meta.manual_workaround_score ?? 0));
  add("strategic_alignment", Number(meta.strategic_alignment_score ?? expr.strategic_alignment?.default ?? 50));

  const score = Math.round(factors.reduce((s, f) => s + f.weighted, 0) * 100) / 100;

  let decision: string;
  if (score <= (thresholds.operational ?? 39.99)) decision = "operational";
  else if (score <= (thresholds.problem_review ?? 69.99)) decision = "problem_review";
  else if (score <= (thresholds.project_review ?? 84.99)) decision = "project_review";
  else decision = "auto_project";

  const top = [...factors].sort((a, b) => b.weighted - a.weighted).slice(0, 3).map((f) => f.code);
  const explanation = `Score ${score}. Factores principales: ${top.join(", ")}. Decision del motor: ${decision}.`;

  const { data: evalRow, error: evalErr } = await supabase
    .from("rule_evaluation")
    .insert({
      tenant_id: ctx.tenantId,
      rule_id: rule.id,
      rule_version_id: rv.id,
      entity_type: "incident",
      entity_id: incidentId,
      evaluation_context: "manual_evaluate",
      input_json: { financial: inc.financial_impact_estimate, recurrence, criticality: critLevel, partner_impact: inc.partner_impact },
      output_json: { score, decision, factors },
      score,
      decision,
      explanation,
      evaluated_by_actor_type: "user",
      evaluated_by_actor_id: ctx.user.id,
    })
    .select("id")
    .single();
  if (evalErr) return { ok: false, error: evalErr.message };

  const candidate = decision === "project_review" || decision === "auto_project";
  await supabase
    .from("incident")
    .update({ transformation_score: score, transformation_candidate: candidate, transformation_decision: decision })
    .eq("id", incidentId);

  if (candidate) {
    const { data: existing } = await supabase
      .from("project_recommendation")
      .select("id")
      .eq("incident_id", incidentId)
      .in("recommendation_status", ["pending", "deferred"])
      .limit(1);
    if (!existing || existing.length === 0) {
      await supabase.from("project_recommendation").insert({
        tenant_id: ctx.tenantId,
        incident_id: incidentId,
        rule_evaluation_id: evalRow.id,
        transformation_score: score,
        recommended_project_type: "evolution",
        recommended_name: `Evolucion: ${inc.title}`.slice(0, 250),
        recommended_business_case: { origin_incident: inc.incident_number, decision, score },
        recommendation_status: "pending",
      });
    }
  }

  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/rules");
  return { ok: true, score, decision, factors, explanation };
}
