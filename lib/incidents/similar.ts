import type { SupabaseClient } from "@supabase/supabase-js";
import { tokenize, scoreCandidate } from "@/lib/portal/match";

// Deteccion de casos SIMILARES en el REGISTRO (deduplicacion, no deflection).
// A diferencia de searchKnowledge (KB + casos RESUELTOS), aqui buscamos casos ABIERTOS:
// un duplicado tipico es un caso que sigue vivo. Motor lexico puro reusado de match.ts;
// cero IA, determinista y testeable. Sugiere sin bloquear (§11: la herramienta sugiere,
// el humano decide). Opera sobre el BORRADOR antes del insert (el caso aun no existe).

/** Estados liquidados: no son candidatos a duplicado de un caso que se esta registrando. */
export const SETTLED_STATUSES = ["resolved", "closed", "cancelled"];

/** Umbral de relevancia. Espeja el precedente MIN=2 de searchKnowledge (constante de tuning,
 *  no regla de negocio). Requiere mas que una sola palabra suelta. */
export const SIMILAR_MIN = 2;
const CATEGORY_BOOST = 2; // misma categoria: senal fuerte de duplicado
const CI_BOOST = 2; // misma aplicacion/sistema afectado: senal fuerte de duplicado

export type SimilarDraft = {
  title: string;
  description?: string | null;
  categoryId?: string | null;
  affectedCiId?: string | null;
  /** Excluir un caso del resultado (p.ej. al editar, no matchearse a si mismo). */
  excludeId?: string | null;
};

/** Fila candidata (forma minima leida de public.incident). */
export type CandidateRow = {
  id: string;
  incident_number: string;
  title: string;
  description: string | null;
  status: string;
  category_id: string | null;
  affected_ci_id: string | null;
};

export type SimilarCaseHit = {
  id: string;
  incident_number: string;
  title: string;
  status: string;
  score: number;
  sameCategory: boolean;
  sameCi: boolean;
};

/** Puntua y ordena candidatos contra el borrador. PURA (sin BD): base del testeo.
 *  Un match de solo categoria/CI sin solape textual NO es duplicado: se exige relevancia
 *  lexica minima (>=1) antes de sumar los refuerzos de categoria/aplicacion. */
export function rankSimilar(draft: SimilarDraft, candidates: CandidateRow[], limit = 5): SimilarCaseHit[] {
  const terms = tokenize(`${draft.title ?? ""} ${draft.description ?? ""}`);
  if (terms.length === 0) return [];

  return candidates
    .filter((c) => c.id !== draft.excludeId)
    .map((c) => {
      const textScore = scoreCandidate({ title: c.title, body: c.description }, terms);
      const sameCategory = !!draft.categoryId && c.category_id === draft.categoryId;
      const sameCi = !!draft.affectedCiId && c.affected_ci_id === draft.affectedCiId;
      const score = textScore >= 1 ? textScore + (sameCategory ? CATEGORY_BOOST : 0) + (sameCi ? CI_BOOST : 0) : 0;
      return { id: c.id, incident_number: c.incident_number, title: c.title, status: c.status, score, sameCategory, sameCi };
    })
    .filter((s) => s.score >= SIMILAR_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Busca casos ABIERTOS similares al borrador (RLS acota por tenant). Si `ownerId` viene,
 *  limita a los casos reportados por ese usuario (dedup del portal: "ya reportaste esto",
 *  sin exponer casos de otros usuarios del tenant). */
export async function findSimilarOpenCases(
  supabase: SupabaseClient,
  draft: SimilarDraft,
  opts?: { ownerId?: string | null },
): Promise<SimilarCaseHit[]> {
  if (tokenize(`${draft.title ?? ""} ${draft.description ?? ""}`).length === 0) return [];

  let q = supabase
    .from("incident")
    .select("id, incident_number, title, description, status, category_id, affected_ci_id")
    .not("status", "in", `(${SETTLED_STATUSES.join(",")})`)
    .order("opened_at", { ascending: false })
    .limit(80);
  if (opts?.ownerId) q = q.eq("reported_by_user_id", opts.ownerId);

  const { data } = await q;
  return rankSimilar(draft, (data ?? []) as CandidateRow[]);
}
