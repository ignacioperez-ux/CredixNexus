"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { callClaude } from "@/lib/ai/anthropic";
import { extractJson, clampPct, normalizeEnum } from "@/lib/ai/parse";

// Features IA de F-Fin5: clasificar categoria, sentimiento y casos similares.
// Gobernanza (§11): la IA SUGIERE, el humano decide; toda accion se registra en
// agent_action (modelo, input/output, confianza). Cero mock: sin clave -> ai_not_configured.

async function logAgentAction(
  ctx: NonNullable<Awaited<ReturnType<typeof getContext>>>,
  agent: string, action: string, incidentId: string, model: string,
  input: Record<string, unknown>, output: Record<string, unknown>,
) {
  await ctx.supabase.from("agent_action").insert({
    tenant_id: ctx.tenantId,
    agent_name: agent,
    model_provider: "anthropic",
    model_name: model,
    requested_by_user_id: ctx.accountId,
    related_entity_type: "incident",
    related_entity_id: incidentId,
    action_type: action,
    input_json: input,
    output_json: output,
    human_review_required: true,
    status: "completed",
  });
}

// ---- 1. Clasificacion de categoria ----------------------------------------
export type ClassifyResult = { ok: boolean; error?: string; code?: string; name?: string; categoryId?: string; confidence?: number; reason?: string };

export async function classifyIncident(incidentId: string): Promise<ClassifyResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };

  const { data: inc } = await ctx.supabase.from("incident").select("title, description, category").eq("id", incidentId).maybeSingle();
  if (!inc) return { ok: false, error: "not_found" };

  // Catalogo real (cero hardcode): las opciones vienen de la BD.
  const { data: cats } = await ctx.supabase.from("incident_category").select("id, code, name").eq("status", "active").order("name");
  const categories = (cats ?? []) as { id: string; code: string; name: string }[];
  if (categories.length === 0) return { ok: false, error: "no_categories" };

  const list = categories.map((c) => `- ${c.code}: ${c.name}`).join("\n");
  const system =
    "Sos un clasificador ITIL de mesa de ayuda. Elegi la MEJOR categoria para el incidente SOLO de la lista provista. " +
    "No inventes categorias fuera de la lista. Responde UNICAMENTE en JSON: {\"code\":\"<CODE>\",\"confidence\":<0-100>,\"reason\":\"<breve>\"}.";
  const user = `Incidente: ${inc.title}\nDescripcion: ${inc.description}\n\nCategorias disponibles (code: nombre):\n${list}`;

  const result = await callClaude({ system, user, maxTokens: 300 });
  if (!result.ok) return { ok: false, error: result.error };

  const parsed = extractJson<{ code: string; confidence: number; reason: string }>(result.text);
  const match = parsed ? categories.find((c) => c.code === parsed.code) : null;

  await logAgentAction(ctx, "classifier_agent", "classify_category", incidentId, result.model,
    { title: inc.title, current_category: inc.category },
    { suggested_code: parsed?.code, confidence: parsed?.confidence, matched: !!match, usage: result.usage });

  if (!parsed || !match) return { ok: false, error: "unparseable" };
  return { ok: true, code: match.code, name: match.name, categoryId: match.id, confidence: clampPct(parsed.confidence), reason: parsed.reason };
}

/** Aplica la categoria sugerida (mutacion gated: la IA nunca aplica sola, §11). */
export async function applyCategory(incidentId: string, categoryId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };
  if (!(await hasPermission(ctx.supabase, "incident.update"))) return { ok: false, error: "ERR_PERMISSION_DENIED" };
  const { data: cat } = await ctx.supabase.from("incident_category").select("code").eq("id", categoryId).maybeSingle();
  if (!cat) return { ok: false, error: "not_found" };
  const { error } = await ctx.supabase.from("incident").update({ category_id: categoryId, category: (cat.code as string).toLowerCase(), updated_by: ctx.accountId }).eq("id", incidentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true };
}

// ---- 2. Sentimiento del cliente -------------------------------------------
export type SentimentResult = { ok: boolean; error?: string; sentiment?: string; urgency?: string; summary?: string; recommendation?: string };

export async function analyzeSentiment(incidentId: string): Promise<SentimentResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };

  const { data: inc } = await ctx.supabase.from("incident").select("title, description").eq("id", incidentId).maybeSingle();
  if (!inc) return { ok: false, error: "not_found" };
  const { data: comments } = await ctx.supabase
    .from("incident_comment").select("body").eq("incident_id", incidentId).eq("visibility", "partner").eq("is_system_generated", false)
    .order("created_at", { ascending: true }).limit(20);
  const thread = (comments ?? []).map((c) => `- ${c.body}`).join("\n") || "(sin comentarios del cliente)";

  const system =
    "Sos un analista de experiencia del cliente. Evalua el SENTIMIENTO del cliente en este caso a partir del texto provisto. " +
    "Base SOLO en el texto; no inventes. Responde UNICAMENTE en JSON: " +
    "{\"sentiment\":\"negative|neutral|positive\",\"urgency\":\"low|medium|high\",\"summary\":\"<1 linea>\",\"recommendation\":\"<accion sugerida breve>\"}.";
  const user = `Titulo: ${inc.title}\nDescripcion: ${inc.description}\nComunicaciones del cliente:\n${thread}`;

  const result = await callClaude({ system, user, maxTokens: 350 });
  if (!result.ok) return { ok: false, error: result.error };

  const parsed = extractJson<{ sentiment: string; urgency: string; summary: string; recommendation: string }>(result.text);

  await logAgentAction(ctx, "sentiment_agent", "analyze_sentiment", incidentId, result.model,
    { title: inc.title }, { sentiment: parsed?.sentiment, urgency: parsed?.urgency, usage: result.usage });

  if (!parsed) return { ok: false, error: "unparseable" };
  return { ok: true, sentiment: normalizeEnum(parsed.sentiment, ["negative", "neutral", "positive"]), urgency: normalizeEnum(parsed.urgency, ["low", "medium", "high"]), summary: parsed.summary, recommendation: parsed.recommendation };
}

// ---- 3. Casos similares ----------------------------------------------------
export type SimilarItem = { id: string; incident_number: string; title: string; reason: string };
export type SimilarResult = { ok: boolean; error?: string; items?: SimilarItem[] };

export async function findSimilarIncidents(incidentId: string): Promise<SimilarResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };

  const { data: inc } = await ctx.supabase.from("incident").select("title, description, category, affected_ci_id").eq("id", incidentId).maybeSingle();
  if (!inc) return { ok: false, error: "not_found" };

  // Candidatos reales por categoria o misma aplicacion (excluye el propio).
  let q = ctx.supabase
    .from("incident")
    .select("id, incident_number, title, resolution_summary, status")
    .neq("id", incidentId)
    .order("opened_at", { ascending: false })
    .limit(25);
  const orParts: string[] = [];
  if (inc.category) orParts.push(`category.eq.${inc.category}`);
  if (inc.affected_ci_id) orParts.push(`affected_ci_id.eq.${inc.affected_ci_id}`);
  if (orParts.length > 0) q = q.or(orParts.join(","));
  const { data: cands } = await q;
  const candidates = (cands ?? []) as { id: string; incident_number: string; title: string; resolution_summary: string | null; status: string }[];
  if (candidates.length === 0) return { ok: true, items: [] };

  const list = candidates.map((c) => `- ${c.incident_number}: ${c.title}${c.resolution_summary ? ` (resolucion: ${c.resolution_summary})` : ""}`).join("\n");
  const system =
    "Sos un asistente de mesa de ayuda. Del listado de casos candidatos, elegi hasta 3 MAS SIMILARES al caso objetivo. " +
    "Usa SOLO los casos del listado (por su numero exacto). Responde UNICAMENTE en JSON: [{\"number\":\"INC-...\",\"reason\":\"<por que es similar>\"}].";
  const user = `Caso objetivo: ${inc.title}\nDescripcion: ${inc.description}\n\nCandidatos:\n${list}`;

  const result = await callClaude({ system, user, maxTokens: 500 });
  if (!result.ok) return { ok: false, error: result.error };

  const parsed = extractJson<{ number: string; reason: string }[]>(result.text) ?? [];
  const items: SimilarItem[] = parsed
    .map((p) => {
      const c = candidates.find((x) => x.incident_number === p.number);
      return c ? { id: c.id, incident_number: c.incident_number, title: c.title, reason: p.reason } : null;
    })
    .filter((x): x is SimilarItem => x !== null)
    .slice(0, 3);

  await logAgentAction(ctx, "similar_agent", "find_similar", incidentId, result.model,
    { title: inc.title, candidate_count: candidates.length }, { matches: items.map((i) => i.incident_number), usage: result.usage });

  return { ok: true, items };
}

