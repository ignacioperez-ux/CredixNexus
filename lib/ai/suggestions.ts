"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { callClaude } from "@/lib/ai/anthropic";

export type AiResult = { ok: boolean; text?: string; error?: string };

/** Sugiere causa raíz + acciones correctivas (ITIL) para un incidente, con IA.
 *  Gobernanza: la acción se registra en agent_action; el humano revisa y decide. */
export async function generateRca(incidentId: string): Promise<AiResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };

  const { data: inc } = await ctx.supabase
    .from("incident")
    .select("title, description, category, ci:affected_ci_id(name), service:affected_service_id(name)")
    .eq("id", incidentId)
    .maybeSingle();
  if (!inc) return { ok: false, error: "not_found" };

  const ciName = (inc.ci as unknown as { name?: string } | null)?.name ?? "n/d";
  const svcName = (inc.service as unknown as { name?: string } | null)?.name ?? "n/d";

  const system =
    "Sos un analista ITIL de mesa de ayuda. Redactá en español, conciso y accionable, una CAUSA RAIZ probable y ACCIONES CORRECTIVAS para el incidente. " +
    "Basate SOLO en la informacion provista; no inventes datos ni supongas hechos no dados. Formato: 'Causa raiz probable:' y luego 'Acciones correctivas:' con vinetas.";
  const user = `Incidente: ${inc.title}\nDescripcion: ${inc.description}\nCategoria: ${inc.category}\nAplicacion afectada: ${ciName}\nServicio: ${svcName}`;

  const result = await callClaude({ system, user, maxTokens: 700 });
  if (!result.ok) return { ok: false, error: result.error };

  // Auditoria de la accion de IA (spec §5.6 governance-first)
  await ctx.supabase.from("agent_action").insert({
    tenant_id: ctx.tenantId,
    agent_name: "rca_agent",
    model_provider: "anthropic",
    model_name: result.model,
    requested_by_user_id: ctx.accountId,
    related_entity_type: "incident",
    related_entity_id: incidentId,
    action_type: "suggest_rca",
    input_json: { title: inc.title, category: inc.category },
    output_json: { text: result.text, usage: result.usage },
    human_review_required: true,
    status: "completed",
  });

  return { ok: true, text: result.text };
}

/** Explica en lenguaje natural (para negocio) por qué el motor asignó ese score y
 *  decisión, a partir de la última evaluación persistida (rule_evaluation). Sin invención. */
export async function explainScore(incidentId: string): Promise<AiResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };

  const { data: ev } = await ctx.supabase
    .from("rule_evaluation")
    .select("score, decision, output_json")
    .eq("entity_type", "incident")
    .eq("entity_id", incidentId)
    .order("evaluated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ev) return { ok: false, error: "no_evaluation" };

  const factors = ((ev.output_json as { factors?: { code: string; raw: number; weight: number; weighted: number }[] })?.factors ?? [])
    .map((f) => `- ${f.code}: valor ${Math.round(f.raw)}/100, peso ${Math.round(f.weight * 100)}%, aporte ${f.weighted.toFixed(1)}`)
    .join("\n");

  const system =
    "Sos un analista que explica decisiones del motor de transformacion a un lider de negocio (RC). " +
    "Explica en espanol, claro y breve (max 6 lineas), por que se obtuvo ese score y esa decision, destacando los 2-3 factores que mas pesaron. " +
    "Basate SOLO en los datos provistos; no inventes cifras ni factores. No repitas la tabla, interpretala.";
  const user = `Score de transformacion: ${ev.score}\nDecision del motor: ${ev.decision}\nFactores (valor/peso/aporte):\n${factors}`;

  const result = await callClaude({ system, user, maxTokens: 400 });
  if (!result.ok) return { ok: false, error: result.error };

  await ctx.supabase.from("agent_action").insert({
    tenant_id: ctx.tenantId,
    agent_name: "score_explainer",
    model_provider: "anthropic",
    model_name: result.model,
    requested_by_user_id: ctx.accountId,
    related_entity_type: "incident",
    related_entity_id: incidentId,
    action_type: "explain_score",
    input_json: { score: ev.score, decision: ev.decision },
    output_json: { text: result.text, usage: result.usage },
    human_review_required: false,
    status: "completed",
  });

  return { ok: true, text: result.text };
}

/** Redacta un borrador de artículo KB (Markdown) a partir de la resolución del
 *  incidente. El humano revisa/edita y decide guardarlo. Auditado. Sin invención. */
export async function generateKbDraft(incidentId: string): Promise<AiResult & { title?: string }> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };

  const { data: inc } = await ctx.supabase
    .from("incident")
    .select("title, description, category, root_cause_summary, resolution_summary, ci:affected_ci_id(name)")
    .eq("id", incidentId)
    .maybeSingle();
  if (!inc) return { ok: false, error: "not_found" };

  const ciName = (inc.ci as unknown as { name?: string } | null)?.name ?? "n/d";
  const system =
    "Sos un redactor de base de conocimiento ITIL. A partir de un incidente y su resolucion, redacta un articulo " +
    "REUTILIZABLE en espanol, en Markdown. Empieza con '# ' y un titulo claro; luego secciones: Sintoma, Causa, " +
    "Solucion (pasos accionables) y Prevencion. Basate SOLO en la info provista; si falta detalle de la solucion, " +
    "describe pasos generales de diagnostico sin inventar datos especificos. No agregues texto fuera del articulo.";
  const user =
    `Incidente: ${inc.title}\nDescripcion: ${inc.description}\nCategoria: ${inc.category}\nAplicacion: ${ciName}\n` +
    `Causa raiz: ${inc.root_cause_summary ?? "no documentada"}\nResolucion: ${inc.resolution_summary ?? "no documentada"}`;

  const result = await callClaude({ system, user, maxTokens: 1400 });
  if (!result.ok) return { ok: false, error: result.error };

  const firstHeading = result.text.split("\n").find((l) => l.trim().startsWith("# "));
  const title = (firstHeading ? firstHeading.replace(/^#\s+/, "") : inc.title).trim().slice(0, 250);

  await ctx.supabase.from("agent_action").insert({
    tenant_id: ctx.tenantId,
    agent_name: "knowledge_agent",
    model_provider: "anthropic",
    model_name: result.model,
    requested_by_user_id: ctx.accountId,
    related_entity_type: "incident",
    related_entity_id: incidentId,
    action_type: "draft_kb",
    input_json: { title: inc.title, category: inc.category },
    output_json: { text: result.text, usage: result.usage },
    human_review_required: true,
    status: "completed",
  });

  return { ok: true, text: result.text, title };
}

/** Redacta un caso de negocio para un proyecto de Evolución (para el comité/RC).
 *  Data-driven desde el proyecto; interpreta beneficio/costo sin inventar cifras. */
export async function generateBusinessCase(projectId: string): Promise<AiResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };

  const { data: p } = await ctx.supabase
    .from("project")
    .select("name, description, estimated_benefit_amount, estimated_cost_amount, business_unit:business_unit_id(name), incident:created_from_incident_id(title)")
    .eq("id", projectId)
    .maybeSingle();
  if (!p) return { ok: false, error: "not_found" };

  const bu = (p.business_unit as unknown as { name?: string } | null)?.name ?? "n/d";
  const origin = (p.incident as unknown as { title?: string } | null)?.title ?? "n/d";
  const benefit = Number(p.estimated_benefit_amount ?? 0);
  const cost = Number(p.estimated_cost_amount ?? 0);
  const roi = cost > 0 ? Math.round(((benefit - cost) / cost) * 100) : null;

  const system =
    "Redacta un caso de negocio breve y estructurado en espanol para un proyecto de transformacion (Evolucion), " +
    "dirigido a un comite/Responsable Comercial. Secciones: Problema, Objetivo, Beneficios esperados, ROI (interpreta " +
    "beneficio vs costo con las cifras dadas), Riesgos y Recomendacion. Basate SOLO en los datos; no inventes cifras.";
  const user =
    `Proyecto: ${p.name}\nDescripcion: ${p.description ?? "n/d"}\nUnidad de negocio: ${bu}\nIncidente origen: ${origin}\n` +
    `Beneficio estimado: ${benefit}\nCosto estimado: ${cost}\nROI calculado: ${roi != null ? roi + "%" : "n/d"}`;

  const result = await callClaude({ system, user, maxTokens: 1000 });
  if (!result.ok) return { ok: false, error: result.error };

  await ctx.supabase.from("agent_action").insert({
    tenant_id: ctx.tenantId,
    agent_name: "business_case_agent",
    model_provider: "anthropic",
    model_name: result.model,
    requested_by_user_id: ctx.accountId,
    related_entity_type: "project",
    related_entity_id: projectId,
    action_type: "draft_business_case",
    input_json: { name: p.name, benefit, cost, roi },
    output_json: { text: result.text, usage: result.usage },
    human_review_required: true,
    status: "completed",
  });

  return { ok: true, text: result.text };
}

/** Resumen ejecutivo del incidente (para gerencia). Conciso, data-driven, sin invención. */
export async function generateExecutiveSummary(incidentId: string): Promise<AiResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };

  const { data: inc } = await ctx.supabase
    .from("incident")
    .select("incident_number, title, description, category, status, priority, financial_impact_estimate, transformation_score, transformation_decision, ci:affected_ci_id(name)")
    .eq("id", incidentId)
    .maybeSingle();
  if (!inc) return { ok: false, error: "not_found" };

  const ciName = (inc.ci as unknown as { name?: string } | null)?.name ?? "n/d";
  const system =
    "Genera un RESUMEN EJECUTIVO en espanol (maximo 4 lineas) para un gerente: situacion, impacto, estado actual y " +
    "proximo paso. Tono claro y directo. Basate SOLO en los datos provistos; no inventes cifras ni hechos.";
  const user =
    `Ticket: ${inc.incident_number} — ${inc.title}\nDescripcion: ${inc.description}\nAplicacion: ${ciName}\n` +
    `Categoria: ${inc.category}\nEstado: ${inc.status}\nPrioridad: ${inc.priority}\n` +
    `Impacto financiero: ${inc.financial_impact_estimate}\nScore transformacion: ${inc.transformation_score}\n` +
    `Decision: ${inc.transformation_decision ?? "n/d"}`;

  const result = await callClaude({ system, user, maxTokens: 350 });
  if (!result.ok) return { ok: false, error: result.error };

  await ctx.supabase.from("agent_action").insert({
    tenant_id: ctx.tenantId,
    agent_name: "exec_summary_agent",
    model_provider: "anthropic",
    model_name: result.model,
    requested_by_user_id: ctx.accountId,
    related_entity_type: "incident",
    related_entity_id: incidentId,
    action_type: "exec_summary",
    input_json: { incident_number: inc.incident_number },
    output_json: { text: result.text, usage: result.usage },
    human_review_required: false,
    status: "completed",
  });

  return { ok: true, text: result.text };
}

/** Guarda la causa raíz revisada por el humano (decision humana, no automatica). */
export async function saveRootCause(incidentId: string, text: string): Promise<AiResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };
  if (!text || text.trim().length < 3) return { ok: false, error: "ERR_REQUIRED_FIELD" };
  const { error } = await ctx.supabase.from("incident").update({ root_cause_summary: text.trim() }).eq("id", incidentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true };
}
