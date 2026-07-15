import type { SupabaseClient } from "@supabase/supabase-js";
import { helpfulPct, articleHealth, ARTICLE_TYPES } from "@/lib/knowledge/validation";

// KB viva — lectura. RLS aisla por tenant. Los contadores viven denormalizados en el
// articulo (mantenidos por trigger); aqui se derivan % util y salud.

export type ArticleRow = {
  id: string; article_number: string; title: string; category: string; article_type: string; status: string;
  helpful_count: number; not_helpful_count: number; view_count: number; deflection_count: number; escalation_count: number;
  helpful_pct: number | null; health: string; updated_at: string;
};

export type KbMetrics = {
  total: number; active: number;
  by_type: { type: string; count: number }[];
  helpful_pct: number | null; deflections: number; escalations: number;
  needs_review: number; // articulos con salud "poor"
};

export type KbData = { articles: ArticleRow[]; metrics: KbMetrics };

// Tablero de revision: articulos en borrador (draft), con su entidad de origen (capturados al
// cierre o creados manualmente). Para el curador (knowledge.manage).
export type KbReviewItem = {
  id: string; article_number: string; title: string; article_type: string; category: string; created_at: string;
  source: { kind: string; label: string; href: string | null } | null;
};
export async function getKbReviewQueue(supabase: SupabaseClient): Promise<KbReviewItem[]> {
  const { data, error } = await supabase
    .from("knowledge_article")
    .select(`id, article_number, title, article_type, category, created_at,
      source_incident_id, source_project_id, source_change_id, source_major_incident_id, source_problem_id,
      incident:source_incident_id(incident_number), project:source_project_id(project_code, name),
      change:source_change_id(change_number), mi:source_major_incident_id(title), problem:source_problem_id(problem_number)`)
    .eq("status", "draft")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => {
    const row = a as Record<string, unknown>;
    let source: KbReviewItem["source"] = null;
    const inc = row.incident as { incident_number: string } | null;
    const prj = row.project as { project_code: string; name: string } | null;
    const chg = row.change as { change_number: string } | null;
    const mi = row.mi as { title: string } | null;
    const prob = row.problem as { problem_number: string } | null;
    if (row.source_incident_id && inc) source = { kind: "incident", label: inc.incident_number, href: `/incidents/${row.source_incident_id}` };
    else if (row.source_project_id && prj) source = { kind: "project", label: prj.project_code || prj.name, href: `/projects/${row.source_project_id}` };
    else if (row.source_change_id && chg) source = { kind: "change", label: chg.change_number, href: `/changes/${row.source_change_id}` };
    else if (row.source_major_incident_id && mi) source = { kind: "major_incident", label: mi.title, href: `/major-incidents/${row.source_major_incident_id}` };
    else if (row.source_problem_id && prob) source = { kind: "problem", label: prob.problem_number, href: `/problems/${row.source_problem_id}` };
    return {
      id: row.id as string, article_number: row.article_number as string, title: row.title as string,
      article_type: row.article_type as string, category: row.category as string, created_at: row.created_at as string, source,
    };
  });
}

function decorate(a: Record<string, unknown>): ArticleRow {
  const helpful = (a.helpful_count as number) ?? 0;
  const notHelpful = (a.not_helpful_count as number) ?? 0;
  return {
    id: a.id as string, article_number: a.article_number as string, title: a.title as string,
    category: a.category as string, article_type: a.article_type as string, status: a.status as string,
    helpful_count: helpful, not_helpful_count: notHelpful,
    view_count: (a.view_count as number) ?? 0, deflection_count: (a.deflection_count as number) ?? 0,
    escalation_count: (a.escalation_count as number) ?? 0,
    helpful_pct: helpfulPct(helpful, notHelpful), health: articleHealth(helpful, notHelpful),
    updated_at: a.updated_at as string,
  };
}

export async function getKb(supabase: SupabaseClient): Promise<KbData> {
  const { data, error } = await supabase
    .from("knowledge_article")
    .select("id, article_number, title, category, article_type, status, helpful_count, not_helpful_count, view_count, deflection_count, escalation_count, updated_at")
    .neq("status", "deleted")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const articles = (data ?? []).map((a) => decorate(a as Record<string, unknown>));

  const totalHelpful = articles.reduce((s, a) => s + a.helpful_count, 0);
  const totalNot = articles.reduce((s, a) => s + a.not_helpful_count, 0);
  const by_type = ARTICLE_TYPES.map((type) => ({ type, count: articles.filter((a) => a.article_type === type).length })).filter((x) => x.count > 0);

  return {
    articles,
    metrics: {
      total: articles.length,
      active: articles.filter((a) => a.status === "active").length,
      by_type,
      helpful_pct: helpfulPct(totalHelpful, totalNot),
      deflections: articles.reduce((s, a) => s + a.deflection_count, 0),
      escalations: articles.reduce((s, a) => s + a.escalation_count, 0),
      needs_review: articles.filter((a) => a.health === "poor").length,
    },
  };
}

export type ArticleDetail = {
  article: ArticleRow & { content: string; summary: string | null; tags: string[]; source_incident_id: string | null; source_problem_id: string | null };
  problem: { id: string; problem_number: string; title: string } | null;
  myFeedback: { helpful: boolean; comment: string | null } | null;
};

export async function getArticle(supabase: SupabaseClient, id: string, accountId: string | null): Promise<ArticleDetail | null> {
  const { data, error } = await supabase
    .from("knowledge_article")
    .select("id, article_number, title, category, article_type, status, helpful_count, not_helpful_count, view_count, deflection_count, escalation_count, updated_at, source_incident_id, source_problem_id, problem:source_problem_id(id, problem_number, title), versions:knowledge_article_version(version_number, content_markdown, summary, tags)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const versions = (row.versions as { version_number: number; content_markdown: string | null; summary: string | null; tags: string[] }[] | null) ?? [];
  const latest = [...versions].sort((a, b) => b.version_number - a.version_number)[0];
  const base = decorate(row);

  let myFeedback: { helpful: boolean; comment: string | null } | null = null;
  if (accountId) {
    const { data: fb } = await supabase.from("knowledge_feedback").select("helpful, comment").eq("article_id", id).eq("user_account_id", accountId).maybeSingle();
    if (fb) myFeedback = { helpful: fb.helpful as boolean, comment: (fb.comment as string | null) ?? null };
  }

  return {
    article: {
      ...base,
      content: latest?.content_markdown ?? "",
      summary: latest?.summary ?? null,
      tags: latest?.tags ?? [],
      source_incident_id: (row.source_incident_id as string | null) ?? null,
      source_problem_id: (row.source_problem_id as string | null) ?? null,
    },
    problem: (row.problem as { id: string; problem_number: string; title: string } | null) ?? null,
    myFeedback,
  };
}
