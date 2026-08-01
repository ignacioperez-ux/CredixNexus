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

// Sube la prioridad un nivel (p4->p3->p2->p1; p1 se mantiene). Se usa cuando el usuario marca
// que el caso es una REINCIDENCIA (fix previo fallido): un caso que ya se reporto y no se resolvio
// merece mas atencion (P1.5). Mismo criterio en el frontend (chip) y en el backend (createIncident).
export function bumpPriority(p: Priority): Priority {
  const order: Priority[] = ["p4_low", "p3_medium", "p2_high", "p1_critical"];
  const i = order.indexOf(p);
  return i < 0 ? p : order[Math.min(i + 1, order.length - 1)];
}
