import type { SupabaseClient } from "@supabase/supabase-js";

export type CsatSurvey = { id: string; status: string; score: number | null; comment: string | null; submitted_at: string | null };

/** Encuesta de satisfaccion de un caso (si existe). */
export async function getCsatForIncident(supabase: SupabaseClient, incidentId: string): Promise<CsatSurvey | null> {
  const { data, error } = await supabase
    .from("case_survey")
    .select("id, status, score, comment, submitted_at")
    .eq("incident_id", incidentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as CsatSurvey | null;
}
