import type { SupabaseClient } from "@supabase/supabase-js";

// Detalle de caso PROPIO del usuario (P2). Se apoya en RPCs SECURITY DEFINER que exigen
// propiedad (reported_by_user_id = current_account_id()) y devuelven solo campos seguros.

export type MyCaseDetail = {
  id: string; incident_number: string; title: string; description: string | null;
  status: string; priority: string | null; category: string | null;
  opened_at: string; first_response_at: string | null; resolved_at: string | null;
  sla_response_due_at: string | null; sla_resolution_due_at: string | null;
  app: string | null; service: string | null; product: string | null;
  channel: string | null; business_unit: string | null; reporter: string | null;
};

export type CaseThreadItem = { id: string; body: string; created_at: string; is_system_generated: boolean; is_mine: boolean };

export type MyCaseSurvey = {
  status: string; score: number | null; q_resolution: number | null; q_speed: number | null;
  q_attention: number | null; comment: string | null; submitted_at: string | null;
};

export async function getMyCase(supabase: SupabaseClient, id: string): Promise<MyCaseDetail | null> {
  const { data, error } = await supabase.rpc("get_my_case", { p_id: id }).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MyCaseDetail | null) ?? null;
}

export async function getMyCaseThread(supabase: SupabaseClient, id: string): Promise<CaseThreadItem[]> {
  const { data, error } = await supabase.rpc("get_my_case_thread", { p_id: id });
  if (error) throw new Error(error.message);
  return (data as CaseThreadItem[] | null) ?? [];
}

/** Evaluacion existente del caso (para saber si ya fue calificado). RLS por tenant lo permite;
 *  el acceso al caso ya se valido por propiedad en getMyCase. */
export async function getMyCaseSurvey(supabase: SupabaseClient, incidentId: string): Promise<MyCaseSurvey | null> {
  const { data, error } = await supabase
    .from("case_survey")
    .select("status, score, q_resolution, q_speed, q_attention, comment, submitted_at")
    .eq("incident_id", incidentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MyCaseSurvey | null) ?? null;
}
