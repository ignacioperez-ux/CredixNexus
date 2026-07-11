// Helpers puros de parseo de respuestas del modelo (testeables).

/** Extrae el primer bloque JSON ({...} o [...]) de la respuesta del modelo,
 *  tolerando fences ```json y texto alrededor. Devuelve null si no parsea. */
export function extractJson<T>(text: string): T | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "");
  const start = cleaned.search(/[[{]/);
  if (start < 0) return null;
  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(close);
  if (end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

/** Normaliza un valor a un conjunto permitido; si no pertenece, devuelve el central. */
export const normalizeEnum = (v: string, allowed: string[]): string =>
  allowed.includes(v) ? v : allowed[Math.floor(allowed.length / 2)];
