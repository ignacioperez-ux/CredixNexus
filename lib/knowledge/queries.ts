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
