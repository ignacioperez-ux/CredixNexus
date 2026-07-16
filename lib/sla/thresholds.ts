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

/** Rango del bucket (para ordenar/comparar riesgo). */
export function bucketRank(b: RiskBucket): number {
  return ORDER[b];
}

/** Riesgo global de un caso = el peor de sus relojes (respuesta/resolucion). */
export function worstBucket(a: RiskBucket, b: RiskBucket): RiskBucket {
  return ORDER[a] >= ORDER[b] ? a : b;
}

/** true si el caso requiere atencion (>= aviso 75%). */
export function atRisk(bucket: RiskBucket): boolean {
  return bucket === "warning" || bucket === "critical" || bucket === "breached";
}

export const MS_DAY = 86_400_000;

// Vista de un reloj SLA para la UI: separa el % CRUDO (para tooltip/evidencia) del % de BARRA
// (capado a 100, nunca se muestra "56460%") y expone el vencimiento como duracion humana.
export type ClockView = {
  bucket: RiskBucket;
  rawPct: number | null;      // % transcurrido sin cap (evidencia, tooltip)
  barPct: number;             // 0..100 para la barra de progreso
  overdueMs: number | null;   // ms de vencimiento (si vencio); null si aun en rango o N/A
  running: boolean;           // reloj activo (no detenido)
  met: boolean | null;        // reloj detenido: cumplido (true) / tarde (false); null si corre o N/A
  dueAt: string | null;
};

/** Modelo de un reloj para la UI. now se pasa (server) para evitar desfases de render. */
export function clockView(openedAt: string, dueAt: string | null, stoppedAt: string | null, now: number): ClockView {
  const none: ClockView = { bucket: "na", rawPct: null, barPct: 0, overdueMs: null, running: false, met: null, dueAt };
  if (!dueAt) return { ...none, dueAt: null };
  const start = new Date(openedAt).getTime();
  const due = new Date(dueAt).getTime();
  if (!(due > start)) return none;
  if (stoppedAt) {
    const stop = new Date(stoppedAt).getTime();
    const pct = Math.max(0, Math.round((100 * (stop - start)) / (due - start)));
    const met = stop <= due;
    return { bucket: met ? "ok" : "breached", rawPct: pct, barPct: Math.min(pct, 100), overdueMs: met ? null : stop - due, running: false, met, dueAt };
  }
  const pct = Math.max(0, Math.round((100 * (now - start)) / (due - start)));
  return { bucket: riskBucket(pct), rawPct: pct, barPct: Math.min(pct, 100), overdueMs: now > due ? now - due : null, running: true, met: null, dueAt };
}

export type AgingBucket = "lt24" | "d1_3" | "d3_7" | "gt7";

/** Cubeta de antiguedad del vencimiento (para chips/filtro). null si no esta vencido. */
export function agingBucketOf(overdueMs: number | null): AgingBucket | null {
  if (overdueMs == null) return null;
  const d = overdueMs / MS_DAY;
  if (d < 1) return "lt24";
  if (d < 3) return "d1_3";
  if (d < 7) return "d3_7";
  return "gt7";
}

/** Duracion humana compacta: "12 d", "5 h", "30 m". */
export function fmtDurationShort(ms: number): string {
  const abs = Math.abs(ms);
  const d = Math.floor(abs / MS_DAY);
  if (d >= 1) return `${d} d`;
  const h = Math.floor(abs / 3_600_000);
  if (h >= 1) return `${h} h`;
  return `${Math.max(1, Math.floor(abs / 60_000))} m`;
}

/** Duracion humana de dos unidades: "5 d 18 h", "4 h 20 m", "30 m". */
export function fmtDurationLong(ms: number): string {
  const abs = Math.abs(ms);
  const d = Math.floor(abs / MS_DAY);
  const h = Math.floor((abs % MS_DAY) / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  if (d >= 1) return h > 0 ? `${d} d ${h} h` : `${d} d`;
  if (h >= 1) return m > 0 ? `${h} h ${m} m` : `${h} h`;
  return `${Math.max(1, m)} m`;
}
