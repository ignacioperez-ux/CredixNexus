// Utilidades puras de la capa analitica (CSV, salud del servicio). Testeable.

/** Construye un CSV RFC-4180 (escapa comillas, comas y saltos de linea). */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined): string => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const row of rows) lines.push(row.map(esc).join(","));
  return lines.join("\r\n");
}

export type HealthInput = { open: number; p1Open: number; slaBreached: number; sev1: number; unackEscalations: number };
export type Health = { score: number; label: "healthy" | "degraded" | "critical" };

/** Puntaje de salud del servicio 0-100 basado en TASAS relativas al volumen abierto.
 *  Antes penalizaba por conteos absolutos, que con datos reales (p.ej. 158 SLA vencidos)
 *  saturaban el puntaje en 0 y lo volvian no informativo. Ahora cada senal pesa segun su
 *  PROPORCION sobre los casos abiertos; un SEV1 activo es senal fuerte con tope propio. */
export function serviceHealth(i: HealthInput): Health {
  const denom = Math.max(1, i.open); // evita division por cero cuando no hay casos abiertos
  const rate = (n: number) => Math.min(1, Math.max(0, n) / denom);
  let score = 100;
  score -= rate(i.slaBreached) * 55;               // cumplimiento SLA: senal dominante
  score -= rate(i.p1Open) * 25;                    // presion de criticos (P1) abiertos
  score -= rate(i.unackEscalations) * 15;          // escalamientos sin reconocer
  score -= Math.min(30, Math.max(0, i.sev1) * 15); // incidentes mayores SEV1 activos, tope 30
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 80 ? "healthy" : score >= 50 ? "degraded" : "critical";
  return { score, label };
}

/** Maximo de una serie de tendencia (para escalar barras); minimo 1 para evitar /0. */
export function trendMax(trend: { count: number }[]): number {
  return Math.max(1, ...trend.map((t) => t.count));
}
