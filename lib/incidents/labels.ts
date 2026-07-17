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

/** Color + tinte por estado (pill). Usa tokens SEMANTICOS por estado (--st-new/assigned/progress/
 *  waiting/resolved/reopened/triaged), definidos POR TEMA en app/globals.css con el MISMO esquema en
 *  ambos temas: Nuevo=azul, Asignado=indigo, En progreso=ambar, En espera=neutro, Resuelto=verde-agua,
 *  Reabierto=rojo, Triado=indigo. closed/cancelled=neutro e in_evolution=marca. Cada tema lo resuelve
 *  con su paleta (los valores difieren; el mapeo es identico). */
export function statusColors(s: string): { fg: string; bg: string } {
  const map: Record<string, { fg: string; bg: string }> = {
    new: { fg: "var(--st-new)", bg: "var(--st-new-bg)" },
    triaged: { fg: "var(--st-triaged)", bg: "var(--st-triaged-bg)" },
    assigned: { fg: "var(--st-assigned)", bg: "var(--st-assigned-bg)" },
    in_progress: { fg: "var(--st-progress)", bg: "var(--st-progress-bg)" },
    waiting: { fg: "var(--st-waiting)", bg: "var(--st-waiting-bg)" },
    resolved: { fg: "var(--st-resolved)", bg: "var(--st-resolved-bg)" },
    closed: { fg: "var(--muted)", bg: "var(--paper)" },
    reopened: { fg: "var(--st-reopened)", bg: "var(--st-reopened-bg)" },
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
