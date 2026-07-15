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
    .select("*, business_unit:business_unit_id(name), tribe:tribe_id(name, code)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Squad 360 (Fase 2): nombres de los lideres (uuid sin FK -> se resuelven aparte).
export type SquadLeads = { po: string | null; businessOwner: string | null; techLead: string | null; agileLead: string | null };
export async function getSquadLeads(supabase: SupabaseClient, squad: Record<string, unknown>): Promise<SquadLeads> {
  const ids = ["po_user_id", "business_owner_user_id", "tech_lead_user_id", "agile_lead_user_id"]
    .map((k) => squad[k] as string | null).filter((v): v is string => !!v);
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data } = await supabase.from("user_account").select("id, full_name, username, email").in("id", Array.from(new Set(ids)));
    for (const u of (data ?? []) as { id: string; full_name: string | null; username: string | null; email: string | null }[]) {
      names.set(u.id, u.full_name || u.username || u.email || "—");
    }
  }
  const nm = (k: string) => { const v = squad[k] as string | null; return v ? (names.get(v) ?? "—") : null; };
  return { po: nm("po_user_id"), businessOwner: nm("business_owner_user_id"), techLead: nm("tech_lead_user_id"), agileLead: nm("agile_lead_user_id") };
}

// Iniciativas que atiende el squad (backlog): via project_squad (lead + contribuyente).
// `blocked` = tiene algun riesgo abierto de tipo blocker o severidad critica (dato ya existente
// en project_risk; misma nocion que la salud del portafolio en la Torre).
export type SquadInitiative = { id: string; name: string; status: string; wsjf: number; initiative_type: string; job_size: number; role: string; blocked: boolean };
export async function getSquadInitiatives(supabase: SupabaseClient, squadId: string): Promise<SquadInitiative[]> {
  const { data, error } = await supabase
    .from("project_squad")
    .select("role, project:project_id(id, name, status, wsjf, initiative_type, job_size)")
    .eq("squad_id", squadId)
    .neq("status", "deleted");
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown as { role: string; project: { id: string; name: string; status: string; wsjf: number; initiative_type: string; job_size: number } | null }[])
    .filter((r) => r.project)
    .map((r) => ({ ...r.project!, role: r.role }));

  const ids = Array.from(new Set(rows.map((r) => r.id)));
  const blocked = new Set<string>();
  if (ids.length) {
    const { data: risks } = await supabase.from("project_risk").select("project_id, kind, severity, status").in("project_id", ids).neq("status", "resolved");
    for (const rk of ((risks ?? []) as { project_id: string; kind: string; severity: string; status: string }[])) {
      if (rk.kind === "blocker" || rk.severity === "critical") blocked.add(rk.project_id);
    }
  }
  return rows.map((r) => ({ ...r, blocked: blocked.has(r.id) })).sort((a, b) => Number(b.wsjf) - Number(a.wsjf));
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

/** Unidades de negocio activas (para el selector al crear un squad). */
export async function getBusinessUnitOptions(supabase: SupabaseClient) {
  const { data } = await supabase.from("business_unit").select("id, name").eq("status", "active").order("name");
  return (data ?? []) as { id: string; name: string }[];
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
