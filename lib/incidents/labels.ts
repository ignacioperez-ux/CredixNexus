import type { MessageKey } from "@/lib/i18n/dictionaries";

export const statusKey = (s: string): MessageKey => ("st." + s) as MessageKey;
export const priorityKey = (p: string): MessageKey => ("prio." + p) as MessageKey;
export const levelKey = (l: string): MessageKey => ("lvl." + l) as MessageKey;

/** Token CSS de color por prioridad. */
export function priorityColor(p: string): string {
  const map: Record<string, string> = {
    p1_critical: "var(--st-critical)",
    p2_high: "var(--st-high)",
    p3_medium: "var(--st-medium)",
    p4_low: "var(--st-low)",
  };
  return map[p] ?? "var(--muted)";
}

/** Color + tinte por estado (pill). */
export function statusColors(s: string): { fg: string; bg: string } {
  const map: Record<string, { fg: string; bg: string }> = {
    new: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
    triaged: { fg: "var(--st-eval)", bg: "var(--st-eval-bg)" },
    assigned: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
    in_progress: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
    waiting: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
    resolved: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
    closed: { fg: "var(--muted)", bg: "var(--paper)" },
    reopened: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
    cancelled: { fg: "var(--muted)", bg: "var(--paper)" },
    in_evolution: { fg: "var(--accent-2)", bg: "var(--accent-soft)" },
  };
  return map[s] ?? { fg: "var(--muted)", bg: "var(--paper)" };
}

/** Color del transformation score por umbral (design §14). */
export function scoreColor(score: number): string {
  if (score >= 75) return "var(--accent-2)";
  if (score >= 50) return "var(--teal)";
  return "#8A948A";
}
