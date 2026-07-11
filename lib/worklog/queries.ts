import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkLogRow = { id: string; minutes: number; note: string | null; logged_at: string; member: { name: string } | null };
export type IncidentEffort = { totalMinutes: number; entries: WorkLogRow[] };

export async function getIncidentEffort(supabase: SupabaseClient, incidentId: string): Promise<IncidentEffort> {
  const { data, error } = await supabase
    .from("case_work_log")
    .select("id, minutes, note, logged_at, member:member_id(name)")
    .eq("incident_id", incidentId)
    .order("logged_at", { ascending: false });
  if (error) throw new Error(error.message);
  const entries = (data ?? []) as unknown as WorkLogRow[];
  return { totalMinutes: entries.reduce((s, e) => s + (e.minutes ?? 0), 0), entries };
}
