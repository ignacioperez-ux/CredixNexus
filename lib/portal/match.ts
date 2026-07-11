// Portal de autoservicio interno — relevancia de busqueda (pura, testeable).
// Deteccion por solape de terminos sobre datos reales (KB + casos resueltos).
// Cero mock: no fabrica resultados, solo puntua texto real contra la consulta.

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

const STOPWORDS = new Set([
  "the", "and", "or", "for", "with", "is", "it", "this", "that",
  "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "que", "en",
  "con", "para", "por", "como", "mi", "no", "se", "es", "al", "del", "lo", "su",
  "sus", "les", "este", "esta", "eso", "esa", "una", "por",
]);

/** Normaliza (minusculas, sin tildes) y extrae terminos significativos (>=3, sin stopwords). */
export function tokenize(query: string): string[] {
  const norm = (query ?? "").toLowerCase().normalize("NFD").replace(DIACRITICS, "");
  const words = norm.match(/[a-z0-9]+/g) ?? [];
  return [...new Set(words)].filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/** Cantidad de terminos de la consulta presentes en el texto. */
export function relevance(text: string | null | undefined, terms: string[]): number {
  if (!terms.length || !text) return 0;
  const hay = text.toLowerCase().normalize("NFD").replace(DIACRITICS, "");
  let score = 0;
  for (const term of terms) if (hay.includes(term)) score += 1;
  return score;
}

/** Puntua un candidato ponderando titulo > resumen > cuerpo. */
export function scoreCandidate(fields: { title?: string | null; summary?: string | null; body?: string | null }, terms: string[]): number {
  return relevance(fields.title, terms) * 3 + relevance(fields.summary, terms) * 2 + relevance(fields.body, terms);
}

/** Ordena por score desc y devuelve los primeros N con score > 0. */
export function topMatches<T extends { score: number }>(items: T[], limit: number): T[] {
  return items.filter((i) => i.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
