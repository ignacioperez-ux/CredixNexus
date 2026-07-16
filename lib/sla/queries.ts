import type { SupabaseClient } from "@supabase/supabase-js";
import { clockView, worstBucket, atRisk, bucketRank, type RiskBucket, type ClockView } from "./thresholds";

// Gobierno SLA/OLA. RLS aisla por tenant; consultas acotadas al contexto.

const OPEN_STATES_EXCLUDE = ["resolved", "closed", "cancelled"];

export type AtRiskIncident = {
  id: string;
  incident_number: string;
  title: string;
  priority: string;
  status: string;
  assigned_team: string | null;   // Responsable (equipo destino)
  system: string | null;          // Aplicacion / Sistema afectado (CI o servicio)
  response: ClockView;
  resolution: ClockView;
  overall: RiskBucket;
  worstOverdueMs: number | null;   // vencimiento del peor reloj (para chips de antiguedad)
};

export type GovernanceStats = { atRisk: number; warning: number; critical: number; breached: number; openEvents: number };
export type AtRiskData = { incidents: AtRiskIncident[]; stats: GovernanceStats };

export async function getAtRiskIncidents(supabase: SupabaseClient): Promise<AtRiskData> {
  const { data, error } = await supabase
    .from("incident")
    .select("id, incident_number, title, priority, status, assigned_team, opened_at, first_response_at, resolved_at, sla_response_due_at, sla_resolution_due_at, ci:affected_ci_id(name), service:affected_service_id(name)")
    .not("status", "in", `(${OPEN_STATES_EXCLUDE.join(",")})`)
    .order("opened_at", { ascending: true });
  if (error) throw new Error(error.message);

  const now = Date.now();
  const incidents: AtRiskIncident[] = (data ?? []).map((i) => {
    const resp = clockView(i.opened_at as string, i.sla_response_due_at as string | null, i.first_response_at as string | null, now);
    const reso = clockView(i.opened_at as string, i.sla_resolution_due_at as string | null, i.resolved_at as string | null, now);
    const one = (v: unknown): { name: string } | null => (Array.isArray(v) ? (v[0] ?? null) : (v as { name: string } | null));
    const ci = one(i.ci);
    const service = one(i.service);
    const overdue = [resp.overdueMs, reso.overdueMs].filter((x): x is number => x != null);
    return {
      id: i.id as string,
      incident_number: i.incident_number as string,
      title: i.title as string,
      priority: i.priority as string,
      status: i.status as string,
      assigned_team: (i.assigned_team as string | null) ?? null,
      system: ci?.name ?? service?.name ?? null,
      response: resp,
      resolution: reso,
      overall: worstBucket(resp.bucket, reso.bucket),
      worstOverdueMs: overdue.length ? Math.max(...overdue) : null,
    };
  });

  const atRiskList = incidents.filter((i) => atRisk(i.overall)).sort((a, b) => bucketRank(b.overall) - bucketRank(a.overall));

  const { count: openEvents } = await supabase
    .from("escalation_event")
    .select("id", { count: "exact", head: true })
    .eq("acknowledged", false);

  return {
    incidents: atRiskList,
    stats: {
      atRisk: atRiskList.length,
      warning: atRiskList.filter((i) => i.overall === "warning").length,
      critical: atRiskList.filter((i) => i.overall === "critical").length,
      breached: atRiskList.filter((i) => i.overall === "breached").length,
      openEvents: openEvents ?? 0,
    },
  };
}

export type OlaPolicyRow = {
  id: string;
  priority: string;
  assigned_team: string | null;
  response_minutes: number;
  resolution_minutes: number;
  status: string;
};

export async function listOlaPolicies(supabase: SupabaseClient): Promise<OlaPolicyRow[]> {
  const { data, error } = await supabase
    .from("ola_policy")
    .select("id, priority, assigned_team, response_minutes, resolution_minutes, status")
    .neq("status", "deleted")
    .order("priority");
  if (error) throw new Error(error.message);
  return (data ?? []) as OlaPolicyRow[];
}

export type EscalationRuleRow = {
  id: string;
  code: string;
  name: string;
  sla_type: string;
  threshold_pct: number;
  priority: string | null;
  action: string;
  notify_role: string | null;
  action_target: string | null;
  status: string;
};

export async function listEscalationRules(supabase: SupabaseClient): Promise<EscalationRuleRow[]> {
  const { data, error } = await supabase
    .from("escalation_rule")
    .select("id, code, name, sla_type, threshold_pct, priority, action, notify_role, action_target, status")
    .neq("status", "deleted")
    .order("sla_type")
    .order("threshold_pct");
  if (error) throw new Error(error.message);
  return (data ?? []) as EscalationRuleRow[];
}

export type EscalationEventRow = {
  id: string;
  sla_type: string;
  threshold_pct: number;
  elapsed_pct: number;
  action: string;
  action_detail: string | null;
  acknowledged: boolean;
  triggered_at: string;
  incident: { id: string; incident_number: string; title: string } | null;
  rule: { code: string; name: string } | null;
};

export async function listEscalationEvents(supabase: SupabaseClient, limit = 50): Promise<EscalationEventRow[]> {
  const { data, error } = await supabase
    .from("escalation_event")
    .select("id, sla_type, threshold_pct, elapsed_pct, action, action_detail, acknowledged, triggered_at, incident:incident_id(id, incident_number, title), rule:rule_id(code, name)")
    .order("triggered_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EscalationEventRow[];
}

/** Escalaciones sin reconocer para un incidente (para mostrar en el detalle del caso). */
export async function getEscalationsForIncident(supabase: SupabaseClient, incidentId: string) {
  const { data, error } = await supabase
    .from("escalation_event")
    .select("id, sla_type, threshold_pct, elapsed_pct, action, acknowledged, triggered_at, rule:rule_id(code, name)")
    .eq("incident_id", incidentId)
    .order("triggered_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as {
    id: string; sla_type: string; threshold_pct: number; elapsed_pct: number;
    action: string; acknowledged: boolean; triggered_at: string; rule: { code: string; name: string } | null;
  }[];
}

export type SlaFormOptions = { roles: { code: string; name: string }[]; teams: string[] };

/** Opciones reales de catalogo para configurar reglas (roles a notificar, equipos). */
export async function getSlaFormOptions(supabase: SupabaseClient): Promise<SlaFormOptions> {
  const [roles, teams] = await Promise.all([
    supabase.from("role").select("code, name").order("code"),
    supabase.from("incident_category").select("default_team").neq("default_team", null),
  ]);
  const teamSet = new Set<string>();
  for (const t of (teams.data ?? []) as { default_team: string | null }[]) {
    if (t.default_team) teamSet.add(t.default_team);
  }
  return {
    roles: (roles.data ?? []) as SlaFormOptions["roles"],
    teams: [...teamSet].sort(),
  };
}
