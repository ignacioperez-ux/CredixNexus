import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTACHMENT_BUCKET } from "@/lib/casework/queries";

// Detalle de caso PROPIO del usuario (P2). Se apoya en RPCs SECURITY DEFINER que exigen
// propiedad (reported_by_user_id = current_account_id()) y devuelven solo campos seguros.

export type MyCaseDetail = {
  id: string; incident_number: string; title: string; description: string | null;
  status: string; priority: string | null; category: string | null;
  opened_at: string; first_response_at: string | null; resolved_at: string | null;
  sla_response_due_at: string | null; sla_resolution_due_at: string | null;
  app: string | null; service: string | null; product: string | null;
  channel: string | null; business_unit: string | null; reporter: string | null;
  assignee: string | null;
  is_recurrence: boolean; recurrence_of_number: string | null;
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

export type PortalAttachment = {
  id: string; file_name: string; mime_type: string | null; size_bytes: number;
  created_at: string; url: string | null; mine: boolean;
};

const SIGNED_TTL = 60 * 30; // 30 min

/** Adjuntos del caso PROPIO (B2). Owner-check explicito (defense-in-depth) + URLs firmadas.
 *  Solo entrega paths del caso del usuario, asi createSignedUrls no filtra otros casos. */
export async function getMyCaseAttachments(supabase: SupabaseClient, incidentId: string, accountId: string | null): Promise<PortalAttachment[]> {
  if (!accountId) return [];
  const { data: own } = await supabase.from("incident").select("id").eq("id", incidentId).eq("reported_by_user_id", accountId).maybeSingle();
  if (!own) return [];
  const { data: rows } = await supabase
    .from("case_attachment")
    .select("id, file_name, mime_type, size_bytes, storage_path, created_at, uploaded_by")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: false });
  const list = (rows ?? []) as { id: string; file_name: string; mime_type: string | null; size_bytes: number; storage_path: string; created_at: string; uploaded_by: string | null }[];
  if (list.length === 0) return [];
  const { data: signed } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(list.map((r) => r.storage_path), SIGNED_TTL);
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return list.map((r) => ({
    id: r.id, file_name: r.file_name, mime_type: r.mime_type, size_bytes: r.size_bytes, created_at: r.created_at,
    url: urlByPath.get(r.storage_path) ?? null, mine: r.uploaded_by === accountId,
  }));
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
