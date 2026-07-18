"use server";

import { getContext } from "@/lib/auth/context";
import { callClaude } from "@/lib/ai/anthropic";
import { extractJson, clampPct } from "@/lib/ai/parse";
import { minLength } from "@/lib/validation";
import { searchKnowledge, type KbHit, type CaseHit, type SearchResult } from "@/lib/portal/queries";

// Asistente del portal de autoservicio interno. Reusa la busqueda real de KB + casos
// (deflection) y, si la IA esta configurada, produce una guia basada SOLO en ese material.
// Gobernanza (§11): la IA SUGIERE, no crea el caso; toda invocacion se registra en
// agent_action (modelo, input/output, confianza). Sin clave -> degrada a busqueda (sin mock).

export type PortalAssistResult = {
  ok: boolean;
  error?: string;
  aiConfigured: boolean;
  guidance?: string;
  resolved?: boolean;                 // la IA cree que el material resuelve la consulta
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  confidence?: number;
  articles: KbHit[];
  cases: CaseHit[];
};

/** Busqueda lexical de KB + casos resueltos (SIN IA), para sugerir en vivo mientras el
 *  usuario escribe el asunto del caso. Barata: no invoca al modelo. La RLS acota por tenant. */
export async function searchKb(query: string): Promise<SearchResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { articles: [], cases: [] };
  if (query.trim().length < 4) return { articles: [], cases: [] };
  return searchKnowledge(ctx.supabase, query);
}

export async function portalAssist(query: string): Promise<PortalAssistResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED", aiConfigured: false, articles: [], cases: [] };

  const qerr = minLength(query, 8);
  if (qerr) return { ok: false, error: qerr, aiConfigured: false, articles: [], cases: [] };

  const { articles, cases } = await searchKnowledge(ctx.supabase, query);

  const { data: cats } = await ctx.supabase.from("incident_category").select("id, code, name").eq("status", "active").order("name");
  const categories = (cats ?? []) as { id: string; code: string; name: string }[];

  const kbList = articles.length
    ? articles.map((a) => `- ${a.article_number}: ${a.title}${a.summary ? ` — ${a.summary}` : ""}`).join("\n")
    : "(sin articulos relevantes)";
  const caseList = cases.length
    ? cases.map((c) => `- ${c.incident_number}: ${c.title}${c.resolution ? ` (resolucion: ${c.resolution})` : ""}`).join("\n")
    : "(sin casos similares)";
  const catList = categories.map((c) => `- ${c.code}: ${c.name}`).join("\n");

  const system =
    "Sos el asistente del portal de autoservicio interno de Credix (fintech de credito B2B). " +
    "Ayudas a un colaborador a resolver su problema SOLO con el material provisto (articulos KB y casos resueltos). " +
    "No inventes procedimientos ni categorias fuera de las listas. Si el material NO alcanza para resolver, indicalo y " +
    "recomienda crear un caso. Elegi la mejor categoria SOLO de la lista. " +
    "Responde UNICAMENTE en JSON: {\"guidance\":\"<pasos concretos o recomendacion>\",\"resolved\":<true|false>,\"category_code\":\"<CODE|null>\",\"confidence\":<0-100>}.";
  const user = `Consulta del colaborador: ${query}\n\nArticulos KB relevantes:\n${kbList}\n\nCasos resueltos similares:\n${caseList}\n\nCategorias disponibles (code: nombre):\n${catList}`;

  const result = await callClaude({ system, user, maxTokens: 600 });

  // Degradacion controlada: sin IA (o error), devolvemos la busqueda real igual.
  if (!result.ok) {
    return { ok: true, aiConfigured: result.error !== "ai_not_configured", articles, cases };
  }

  const parsed = extractJson<{ guidance: string; resolved: boolean; category_code: string | null; confidence: number }>(result.text);
  const cat = parsed?.category_code ? categories.find((c) => c.code === parsed.category_code) : null;

  await ctx.supabase.from("agent_action").insert({
    tenant_id: ctx.tenantId,
    agent_name: "portal_assist_agent",
    model_provider: "anthropic",
    model_name: result.model,
    requested_by_user_id: ctx.accountId,
    related_entity_type: "portal_query",
    related_entity_id: null,
    action_type: "self_service_assist",
    input_json: { query, kb_matches: articles.map((a) => a.article_number), case_matches: cases.map((c) => c.incident_number) },
    output_json: { resolved: parsed?.resolved ?? null, suggested_category: cat?.code ?? null, confidence: parsed?.confidence ?? null, usage: result.usage },
    human_review_required: true,
    status: "completed",
  });

  return {
    ok: true,
    aiConfigured: true,
    guidance: parsed?.guidance,
    resolved: parsed?.resolved ?? false,
    suggestedCategoryId: cat?.id,
    suggestedCategoryName: cat?.name,
    confidence: parsed ? clampPct(parsed.confidence) : undefined,
    articles,
    cases,
  };
}
