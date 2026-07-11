// Logica pura de riesgo SLA/OLA. Reutilizable en queries, UI y pruebas.
// Un reloj SLA se mide como % transcurrido entre apertura y vencimiento.

export type RiskBucket = "ok" | "warning" | "critical" | "breached" | "na";

export const WARNING_PCT = 75;
export const CRITICAL_PCT = 90;
export const BREACH_PCT = 100;

/** % transcurrido de un reloj. null si el reloj no aplica (sin due o ya detenido). */
export function elapsedPct(openedAt: string, dueAt: string | null, stoppedAt: string | null, now: number): number | null {
  if (!dueAt) return null;
  if (stoppedAt) return null; // reloj detenido (respondido/resuelto): ya no corre
  const start = new Date(openedAt).getTime();
  const due = new Date(dueAt).getTime();
  if (!(due > start)) return null;
  const pct = (100 * (now - start)) / (due - start);
  return pct < 0 ? 0 : Math.round(pct);
}

export function riskBucket(pct: number | null): RiskBucket {
  if (pct === null) return "na";
  if (pct >= BREACH_PCT) return "breached";
  if (pct >= CRITICAL_PCT) return "critical";
  if (pct >= WARNING_PCT) return "warning";
  return "ok";
}

const ORDER: Record<RiskBucket, number> = { na: 0, ok: 1, warning: 2, critical: 3, breached: 4 };

/** Riesgo global de un caso = el peor de sus relojes (respuesta/resolucion). */
export function worstBucket(a: RiskBucket, b: RiskBucket): RiskBucket {
  return ORDER[a] >= ORDER[b] ? a : b;
}

/** true si el caso requiere atencion (>= aviso 75%). */
export function atRisk(bucket: RiskBucket): boolean {
  return bucket === "warning" || bucket === "critical" || bucket === "breached";
}
