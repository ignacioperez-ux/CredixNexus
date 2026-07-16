import type { SupabaseClient } from "@supabase/supabase-js";

// Responsables de un caso (A3): principal + colaboradores. El principal (is_primary) se espeja en
// incident.assigned_member_id (SLA/escalaciones apuntan a el).
export type IncidentAssignee = { id: string; member_id: string; name: string; is_primary: boolean; is_external: boolean };

export async function getAssignees(supabase: SupabaseClient, incidentId: string): Promise<IncidentAssignee[]> {
  const { data, error } = await supabase
    .from("incident_assignee")
    .select("id, member_id, is_primary, member:member_id(name, is_external)")
    .eq("incident_id", incidentId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { name: string; is_external: boolean } | null;
  return (data ?? []).map((r) => {
    const m = one(r.member);
    return { id: r.id as string, member_id: r.member_id as string, is_primary: !!r.is_primary, name: m?.name ?? "—", is_external: !!m?.is_external };
  });
}
