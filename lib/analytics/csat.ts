// Formato CSAT reutilizable para las tablas XLA (puro, testeable).

import type { Csat } from "@/lib/analytics/queries";

/** Etiqueta de CSAT: "4.5★ (n)" o "—" si no hay respuestas. */
export function csatLabel(c: Csat): string {
  if (!c.csat_responses || c.csat_responses <= 0) return "—";
  return `${c.csat_avg}★ (${c.csat_responses})`;
}

/** % satisfechos como texto, o "—" si no hay respuestas. */
export function satisfiedLabel(c: Csat): string {
  return c.csat_responses > 0 ? `${c.csat_satisfied_pct}%` : "—";
}

/** Umbral de alerta: CSAT bajo (<3.5) con al menos una respuesta. */
export function isLowCsat(c: Csat): boolean {
  return c.csat_responses > 0 && c.csat_avg < 3.5;
}
