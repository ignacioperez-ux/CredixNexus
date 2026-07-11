// KB viva — validacion pura y metricas derivadas (testeable, sin red).

import { ErrorCode } from "@/lib/validation";

export const ARTICLE_TYPES = ["how_to", "runbook", "known_error", "faq", "policy"] as const;
export const FEEDBACK_SOURCES = ["kb", "portal", "incident"] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export function validateArticleType(t: string): string | null {
  return (ARTICLE_TYPES as readonly string[]).includes(t) ? null : ErrorCode.FORMAT;
}

/** % de votos utiles sobre el total de votos. null si no hay votos aun. */
export function helpfulPct(helpful: number, notHelpful: number): number | null {
  const total = helpful + notHelpful;
  if (total <= 0) return null;
  return Math.round((helpful / total) * 100);
}

/** Tasa de deflection: casos evitados sobre (evitados + escalados). null si no hubo uso. */
export function deflectionRate(deflection: number, escalation: number): number | null {
  const total = deflection + escalation;
  if (total <= 0) return null;
  return Math.round((deflection / total) * 100);
}

/** Salud del articulo a partir de su feedback: good/mixed/poor/unrated. */
export function articleHealth(helpful: number, notHelpful: number): "good" | "mixed" | "poor" | "unrated" {
  const pct = helpfulPct(helpful, notHelpful);
  if (pct === null) return "unrated";
  if (pct >= 70) return "good";
  if (pct >= 40) return "mixed";
  return "poor";
}
