// Espejo en TS de la funcion SQL public.derive_priority (matriz ITIL impacto x urgencia).
// Mantener sincronizado con sql/0014_incidents.sql.

export type Impact = "critical" | "high" | "medium" | "low";
export type Urgency = "critical" | "high" | "medium" | "low";
export type Priority = "p1_critical" | "p2_high" | "p3_medium" | "p4_low";

// Prioridad = por el mayor nivel entre impacto y urgencia. Equivale exactamente a
// la matriz de public.derive_priority (sql/0014). Mantener sincronizado.
export function derivePriority(impact: Impact, urgency: Urgency): Priority {
  const rank: Record<Impact | Urgency, number> = { critical: 3, high: 2, medium: 1, low: 0 };
  const m = Math.max(rank[impact], rank[urgency]);
  return m === 3 ? "p1_critical" : m === 2 ? "p2_high" : m === 1 ? "p3_medium" : "p4_low";
}
