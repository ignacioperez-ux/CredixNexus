"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode, minLength, firstError } from "@/lib/validation";
import { validateArticleType } from "@/lib/knowledge/validation";

export type KbSaveResult = { ok: boolean; error?: string; articleNumber?: string };
export type KbResult = { ok: boolean; error?: string };

const VALID_SOURCES = ["kb", "portal", "incident"];

/** Guarda el artículo KB (revisado por el humano) como knowledge_article + versión 1,
 *  enlazado al incidente origen. Validación en 3 capas (BD/backend/frontend). */
export async function saveKbArticle(
  incidentId: string,
  title: string,
  content: string,
  articleType: string = "how_to",
): Promise<KbSaveResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };

  const err = firstError(minLength(title, 5), minLength(content, 10), validateArticleType(articleType));
  if (err) return { ok: false, error: err };

  const { data: inc } = await ctx.supabase.from("incident").select("category").eq("id", incidentId).maybeSingle();
  const category = ((inc?.category as string | undefined) ?? "general").slice(0, 80);

  const { data: article, error: e1 } = await ctx.supabase
    .from("knowledge_article")
    .insert({
      tenant_id: ctx.tenantId,
      title: title.trim().slice(0, 250),
      category,
      article_type: articleType,
      status: "draft",
      owner_user_id: ctx.accountId,
      source_incident_id: incidentId,
    })
    .select("id, article_number")
    .single();
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await ctx.supabase.from("knowledge_article_version").insert({
    tenant_id: ctx.tenantId,
    article_id: article.id,
    version_number: 1,
    content_markdown: content.trim(),
    created_by: ctx.accountId,
  });
  if (e2) return { ok: false, error: e2.message };

  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true, articleNumber: article.article_number as string };
}

/** Feedback util/no-util del articulo (KB viva). Un voto por usuario (upsert). Auditado.
 *  Un voto util desde el portal cuenta como deflection (caso evitado). */
export async function submitKbFeedback(articleId: string, helpful: boolean, comment: string | null, source: string = "kb"): Promise<KbResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await hasPermission(ctx.supabase, "knowledge.feedback"))) return { ok: false, error: ErrorCode.PERMISSION };
  if (!VALID_SOURCES.includes(source)) return { ok: false, error: ErrorCode.FORMAT };

  const { error } = await ctx.supabase
    .from("knowledge_feedback")
    .upsert(
      { tenant_id: ctx.tenantId, article_id: articleId, user_account_id: ctx.accountId, helpful, comment: comment?.trim() || null, source },
      { onConflict: "article_id,user_account_id" },
    );
  if (error) return { ok: false, error: error.message };

  // Un voto util en el portal = deflection (se resolvio sin abrir caso).
  if (helpful && source === "portal") {
    await ctx.supabase.from("knowledge_event").insert({ tenant_id: ctx.tenantId, article_id: articleId, event_type: "deflection", user_account_id: ctx.accountId, source: "portal" });
  }
  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${articleId}`);
  return { ok: true };
}

/** Telemetria de uso (view/deflection/escalation). No requiere permiso de gestion; solo sesion. */
export async function recordKbEvent(articleId: string, eventType: "view" | "deflection" | "escalation", source: string = "portal", query?: string): Promise<KbResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!["view", "deflection", "escalation"].includes(eventType) || !VALID_SOURCES.includes(source)) return { ok: false, error: ErrorCode.FORMAT };
  const { error } = await ctx.supabase.from("knowledge_event").insert({
    tenant_id: ctx.tenantId, article_id: articleId, event_type: eventType, user_account_id: ctx.accountId, source, query: query?.slice(0, 500) || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Cambia el tipo del articulo (gated knowledge.manage). */
export async function setArticleType(articleId: string, articleType: string): Promise<KbResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await hasPermission(ctx.supabase, "knowledge.manage"))) return { ok: false, error: ErrorCode.PERMISSION };
  const v = validateArticleType(articleType);
  if (v) return { ok: false, error: v };
  const { error } = await ctx.supabase.from("knowledge_article").update({ article_type: articleType, updated_by: ctx.accountId }).eq("id", articleId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/knowledge/${articleId}`);
  revalidatePath("/knowledge");
  return { ok: true };
}

/** Publica un articulo en borrador (gated knowledge.manage). */
export async function publishArticle(articleId: string): Promise<KbResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await hasPermission(ctx.supabase, "knowledge.manage"))) return { ok: false, error: ErrorCode.PERMISSION };
  const { error } = await ctx.supabase.from("knowledge_article").update({ status: "active", updated_by: ctx.accountId }).eq("id", articleId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/knowledge/${articleId}`);
  revalidatePath("/knowledge");
  return { ok: true };
}
