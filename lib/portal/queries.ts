import type { SupabaseClient } from "@supabase/supabase-js";
import { tokenize, scoreCandidate, topMatches } from "@/lib/portal/match";

// Portal de autoservicio: busqueda de deflection sobre datos REALES (RLS por tenant).
// KB publicada (articulos activos + su ultima version) y casos resueltos con resolucion.

export type KbHit = { id: string; article_number: string; title: string; category: string; summary: string | null; content: string; score: number };
export type CaseHit = { id: string; incident_number: string; title: string; category: string; resolution: string | null; score: number };
export type PortalCategory = { id: string; code: string; name: string; name_en: string | null };
export type SearchResult = { articles: KbHit[]; cases: CaseHit[] };

type ArticleVersion = { version_number: number; content_markdown: string | null; summary: string | null };

function latestVersion(versions: ArticleVersion[] | null): ArticleVersion | null {
  if (!versions || versions.length === 0) return null;
  return [...versions].sort((a, b) => b.version_number - a.version_number)[0];
}

export async function searchKnowledge(supabase: SupabaseClient, query: string): Promise<SearchResult> {
  const terms = tokenize(query);
  if (terms.length === 0) return { articles: [], cases: [] };

  // --- Articulos KB activos + ultima version ---
  const { data: arts } = await supabase
    .from("knowledge_article")
    .select("id, article_number, title, category, versions:knowledge_article_version(version_number, content_markdown, summary)")
    .eq("status", "active")
    .limit(80);
  const articles: KbHit[] = (arts ?? []).map((a) => {
    const row = a as Record<string, unknown>;
    const v = latestVersion(row.versions as ArticleVersion[] | null);
    return {
      id: row.id as string,
      article_number: row.article_number as string,
      title: row.title as string,
      category: row.category as string,
      summary: v?.summary ?? null,
      content: v?.content_markdown ?? "",
      score: scoreCandidate({ title: row.title as string, summary: v?.summary, body: v?.content_markdown }, terms),
    };
  });

  // --- Casos resueltos con resolucion (conocimiento tacito) ---
  const { data: incs } = await supabase
    .from("incident")
    .select("id, incident_number, title, category, resolution_summary")
    .eq("status", "resolved")
    .order("resolved_at", { ascending: false })
    .limit(80);
  const cases: CaseHit[] = (incs ?? []).map((c) => {
    const row = c as Record<string, unknown>;
    return {
      id: row.id as string,
      incident_number: row.incident_number as string,
      title: row.title as string,
      category: row.category as string,
      resolution: (row.resolution_summary as string | null) ?? null,
      score: scoreCandidate({ title: row.title as string, body: row.resolution_summary as string | null }, terms),
    };
  });

  // Umbral de relevancia: exige mas que una sola palabra en el cuerpo (evita "no relacionados").
  const MIN = 2;
  return {
    articles: topMatches(articles.filter((a) => a.score >= MIN), 5),
    cases: topMatches(cases.filter((c) => c.score >= MIN), 5),
  };
}

/** Aplicaciones/sistemas (CIs) para el selector "Aplicacion afectada" del intake. */
export type PortalApp = { id: string; name: string; ci_type: string };
export async function listApplications(supabase: SupabaseClient): Promise<PortalApp[]> {
  const { data, error } = await supabase
    .from("configuration_item")
    .select("id, name, ci_type")
    .neq("status", "deleted")
    .order("ci_type")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as PortalApp[];
}

/** Casos que el propio usuario reporto (auto-scope por reported_by). RLS acota por tenant;
 *  aqui filtramos a los propios para dar al usuario final su "Mis casos" sin exponer el resto.
 *  Incluye SLA/prioridad reales para el Hub (anillo SLA, donut de estado). */
export type MyCase = {
  id: string; incident_number: string; title: string; status: string; opened_at: string;
  priority: string | null; sla_resolution_due_at: string | null; first_response_at: string | null; resolved_at: string | null;
  survey_status: string | null; // estado de la encuesta CSAT (pending/submitted/na) para el estado "pendiente de evaluacion / evaluado"
};
export async function getMyReportedCases(supabase: SupabaseClient, accountId: string | null): Promise<MyCase[]> {
  if (!accountId) return [];
  const { data, error } = await supabase
    .from("incident")
    .select("id, incident_number, title, status, opened_at, priority, sla_resolution_due_at, first_response_at, resolved_at, survey:case_survey(status)")
    .eq("reported_by_user_id", accountId)
    .order("opened_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const s = row.survey as { status: string }[] | { status: string } | null;
    const survey_status = Array.isArray(s) ? (s[0]?.status ?? null) : (s?.status ?? null);
    return { ...(row as unknown as MyCase), survey_status };
  });
}

/** Estado de evaluacion derivado para el usuario: los casos resueltos/cerrados estan "evaluados"
 *  (encuesta enviada) o "pendientes de evaluacion"; el resto no aplica. Presentacion pura. */
export type EvalState = "evaluated" | "pending_eval" | null;
export function evalState(status: string, surveyStatus: string | null): EvalState {
  if (surveyStatus === "submitted") return "evaluated";
  if (status === "resolved" || status === "closed") return "pending_eval";
  return null;
}

/** Catalogo de categorias para el formulario de creacion de caso (cero hardcode). */
export async function listPortalCategories(supabase: SupabaseClient): Promise<PortalCategory[]> {
  const { data, error } = await supabase
    .from("incident_category")
    .select("id, code, name, name_en")
    .eq("status", "active")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as PortalCategory[];
}
