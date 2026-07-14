import type { SupabaseClient } from "@supabase/supabase-js";

export type CsatSurvey = {
  id: string; status: string; score: number | null; comment: string | null; submitted_at: string | null;
  q_resolution: number | null; q_speed: number | null; q_attention: number | null;
};

/** Encuesta de satisfaccion de un caso (si existe). Incluye las 3 dimensiones (Resolucion/Rapidez/
 *  Atencion) que captura el usuario final; nulas si la calificacion fue de puntaje unico. */
export async function getCsatForIncident(supabase: SupabaseClient, incidentId: string): Promise<CsatSurvey | null> {
  const { data, error } = await supabase
    .from("case_survey")
    .select("id, status, score, comment, submitted_at, q_resolution, q_speed, q_attention")
    .eq("incident_id", incidentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as CsatSurvey | null;
}
