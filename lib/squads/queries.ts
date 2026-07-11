import type { SupabaseClient } from "@supabase/supabase-js";

// Squads + roster. RLS aisla por tenant.

export type SquadRow = {
  id: string;
  code: string;
  name: string;
  is_transversal: boolean;
  capacity_points: number | null;
  status: string;
  business_unit: { name: string } | null;
  member_count: number;
  allocated_points: number;
};

export async function listSquads(supabase: SupabaseClient): Promise<SquadRow[]> {
  const { data, error } = await supabase
    .from("squad")
    .select("id, code, name, is_transversal, capacity_points, status, business_unit:business_unit_id(name), members:squad_member(allocation_pct, status)")
    .neq("status", "deleted")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => {
    const row = s as Record<string, unknown>;
    const members = (row.members as { allocation_pct: number; status: string }[] | null) ?? [];
    delete row.members;
    const active = members.filter((m) => m.status === "active");
    return {
      ...(row as unknown as Omit<SquadRow, "member_count" | "allocated_points">),
      member_count: active.length,
      allocated_points: active.reduce((s2, m) => s2 + (m.allocation_pct ?? 0), 0),
    };
  });
}

export async function getSquad(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("squad")
    .select("*, business_unit:business_unit_id(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type RosterRow = {
  id: string;
  squad_role: string;
  allocation_pct: number;
  status: string;
  member: { id: string; name: string; discipline: string | null; seniority: string | null; is_external: boolean } | null;
};

export async function getSquadRoster(supabase: SupabaseClient, squadId: string): Promise<RosterRow[]> {
  const { data, error } = await supabase
    .from("squad_member")
    .select("id, squad_role, allocation_pct, status, member:member_id(id, name, discipline, seniority, is_external)")
    .eq("squad_id", squadId)
    .neq("status", "deleted")
    .order("squad_role");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RosterRow[];
}

/** Miembros del roster global aun no asignados a este squad (para el selector). */
export async function getAssignableMembers(supabase: SupabaseClient, squadId: string) {
  const { data: inSquad } = await supabase.from("squad_member").select("member_id").eq("squad_id", squadId);
  const excluded = (inSquad ?? []).map((m) => m.member_id as string);
  let q = supabase.from("team_member").select("id, name, discipline, is_external").eq("status", "active").order("name");
  if (excluded.length > 0) q = q.not("id", "in", `(${excluded.join(",")})`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string; discipline: string | null; is_external: boolean }[];
}

/** Squads a los que pertenece un miembro (para la vista de talento). */
export async function getSquadsForMember(supabase: SupabaseClient, memberId: string) {
  const { data, error } = await supabase
    .from("squad_member")
    .select("squad_role, allocation_pct, squad:squad_id(id, name)")
    .eq("member_id", memberId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as { squad_role: string; allocation_pct: number; squad: { id: string; name: string } | null }[];
}
