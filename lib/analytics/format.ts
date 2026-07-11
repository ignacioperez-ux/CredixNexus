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

export type HealthInput = { p1Open: number; slaBreached: number; sev1: number; unackEscalations: number };
export type Health = { score: number; label: "healthy" | "degraded" | "critical" };

/** Puntaje de salud del servicio 0-100 penalizando senales criticas. */
export function serviceHealth(i: HealthInput): Health {
  let score = 100;
  score -= i.p1Open * 6;
  score -= i.slaBreached * 4;
  score -= i.sev1 * 20;
  score -= i.unackEscalations * 1;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 80 ? "healthy" : score >= 50 ? "degraded" : "critical";
  return { score, label };
}

/** Maximo de una serie de tendencia (para escalar barras); minimo 1 para evitar /0. */
export function trendMax(trend: { count: number }[]): number {
  return Math.max(1, ...trend.map((t) => t.count));
}
