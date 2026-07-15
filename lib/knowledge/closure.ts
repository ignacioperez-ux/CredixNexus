import type { SupabaseClient } from "@supabase/supabase-js";

// Captura de conocimiento al CIERRE de un caso/mejora/cambio/incidente mayor/proyecto.
// Modulo server-only (NO es "use server"): lo llaman los server actions de cierre pasando su
// propio supabase (RLS del usuario). Registra un articulo (draft, tipo known_error) con el caso y
// su solucion para reuso ante casos similares. Idempotente por entidad de origen (indice unico +
// chequeo). No es fatal si falla: el cierre NO se revierte porque el KB no se pudo escribir.
const SRC_COL = {
  incident: "source_incident_id", project: "source_project_id", change: "source_change_id",
  major_incident: "source_major_incident_id", problem: "source_problem_id",
} as const;
export type ClosureKind = keyof typeof SRC_COL;

export async function captureClosureKnowledge(
  supabase: SupabaseClient,
  tenantId: string | null,
  accountId: string | null,
  p: { kind: ClosureKind; id: string; title: string; category?: string; symptom?: string; solution?: string },
): Promise<{ ok: boolean; articleId?: string; skipped?: boolean }> {
  if (!tenantId) return { ok: false };
  try {
    const col = SRC_COL[p.kind];
    const { data: existing } = await supabase.from("knowledge_article").select("id").eq(col, p.id).limit(1);
    if ((existing?.length ?? 0) > 0) return { ok: true, skipped: true };

    // Titulo seguro (la BD exige >= 5 caracteres).
    let title = (p.title ?? "").trim().slice(0, 250);
    if (title.length < 5) title = `Caso cerrado ${title}`.trim().slice(0, 250);

    const body = [
      `## Caso`, (p.title ?? "").trim(),
      ``, `## Sintoma`, p.symptom?.trim() || "—",
      ``, `## Solucion`, p.solution?.trim() || "_(Completar por el equipo antes de publicar.)_",
    ].join("\n");

    const { data: article, error: e1 } = await supabase.from("knowledge_article").insert({
      tenant_id: tenantId,
      title,
      category: (p.category || "general").slice(0, 80),
      article_type: "known_error",
      status: "draft",
      owner_user_id: accountId,
      [col]: p.id,
    }).select("id").single();
    if (e1 || !article) return { ok: false };

    await supabase.from("knowledge_article_version").insert({
      tenant_id: tenantId, article_id: article.id, version_number: 1, content_markdown: body, created_by: accountId,
    });
    return { ok: true, articleId: article.id as string };
  } catch {
    return { ok: false };
  }
}
