import type { SupabaseClient } from "@supabase/supabase-js";

// FUENTE UNICA DE VERDAD de demanda/capacidad de squads (§0). Antes cada pantalla calculaba
// distinto: /workload usaba effort_points de tareas abiertas via project.squad_id (correcto),
// mientras Squad 360 y el portafolio usaban project.job_size via project_squad (N:N) — dos
// linajes y dos magnitudes -> el mismo squad mostraba numeros distintos (p.ej. Cobranza 0/7 vs
// 10/7). Aqui se centraliza el calculo CANONICO y todas las vistas lo consumen.
//
//   demanda(squad)  = suma de effort_points de tareas ABIERTAS (status <> 'done') cuyo proyecto
//                     pertenece al squad (project.squad_id)
//   capacidad(squad)= squad.capacity_points
//   FTE(squad)      = suma de allocation_pct del roster activo / 100

export type SquadCapacity = {
  id: string; code: string; name: string; squad_type: string | null; is_transversal: boolean;
  tribe_id: string | null; tribe_name: string | null; tribe_code: string | null; business_unit_name: string | null;
  po_user_id: string | null;
  capacity_points: number; demand_points: number; load_pct: number | null; over: boolean;
  fte: number; member_count: number;
};

type SquadRaw = {
  id: string; code: string; name: string; squad_type: string | null; is_transversal: boolean;
  capacity_points: number | null; po_user_id: string | null; tribe_id: string | null;
  tribe: { name: string; code: string } | null; business_unit: { name: string } | null;
};

export async function getSquadCapacities(supabase: SupabaseClient): Promise<SquadCapacity[]> {
  const [squadRes, projRes, taskRes, memberRes] = await Promise.all([
    supabase.from("squad").select("id, code, name, squad_type, is_transversal, capacity_points, po_user_id, tribe_id, tribe:tribe_id(name, code), business_unit:business_unit_id(name)").eq("status", "active").order("name"),
    supabase.from("project").select("id, squad_id"),
    supabase.from("project_task").select("effort_points, status, project_id"),
    supabase.from("squad_member").select("squad_id, allocation_pct, status"),
  ]);
  const squads = (squadRes.data ?? []) as unknown as SquadRaw[];
  const projSquad = new Map((((projRes.data ?? []) as { id: string; squad_id: string | null }[])).map((p) => [p.id, p.squad_id]));
  const tasks = (taskRes.data ?? []) as { effort_points: number; status: string; project_id: string }[];
  const members = (memberRes.data ?? []) as { squad_id: string; allocation_pct: number; status: string }[];

  const demand = new Map<string, number>();
  for (const tk of tasks) {
    if (tk.status === "done") continue;
    const sid = projSquad.get(tk.project_id);
    if (!sid) continue;
    demand.set(sid, (demand.get(sid) ?? 0) + (tk.effort_points ?? 0));
  }
  const alloc = new Map<string, number>();
  const heads = new Map<string, number>();
  for (const m of members) {
    if (m.status !== "active") continue;
    alloc.set(m.squad_id, (alloc.get(m.squad_id) ?? 0) + (m.allocation_pct ?? 0));
    heads.set(m.squad_id, (heads.get(m.squad_id) ?? 0) + 1);
  }

  return squads.map((s) => {
    const cap = s.capacity_points ?? 0;
    const dem = demand.get(s.id) ?? 0;
    const loadPct = cap > 0 ? Math.round((dem / cap) * 100) : null;
    return {
      id: s.id, code: s.code, name: s.name, squad_type: s.squad_type, is_transversal: s.is_transversal,
      tribe_id: s.tribe_id, tribe_name: s.tribe?.name ?? null, tribe_code: s.tribe?.code ?? null,
      business_unit_name: s.business_unit?.name ?? null, po_user_id: s.po_user_id,
      capacity_points: cap, demand_points: dem, load_pct: loadPct, over: loadPct != null && loadPct > 100,
      fte: Math.round(((alloc.get(s.id) ?? 0) / 100) * 10) / 10, member_count: heads.get(s.id) ?? 0,
    };
  });
}

// Tarjeta de squad (/squads): la capacidad canonica + roster (avatares), PO resuelto y top backlog.
export type SquadCard = SquadCapacity & {
  po_name: string | null;
  roster: { id: string; name: string }[];
  backlog: { id: string; name: string; wsjf: number; type: string; status: string }[];
};

export async function getSquadCards(supabase: SupabaseClient): Promise<SquadCard[]> {
  const caps = await getSquadCapacities(supabase);
  const poIds = Array.from(new Set(caps.map((c) => c.po_user_id).filter((v): v is string => !!v)));
  const [rosterRes, backlogRes, poRes] = await Promise.all([
    supabase.from("squad_member").select("squad_id, member:member_id(id, name)").eq("status", "active"),
    supabase.from("project_squad").select("squad_id, project:project_id(id, name, wsjf, initiative_type, status)").neq("status", "deleted"),
    poIds.length ? supabase.from("user_account").select("id, full_name, username, email").in("id", poIds) : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const roster = new Map<string, { id: string; name: string }[]>();
  for (const r of ((rosterRes.data ?? []) as unknown as { squad_id: string; member: { id: string; name: string } | null }[])) {
    if (!r.member) continue;
    const arr = roster.get(r.squad_id) ?? []; arr.push(r.member); roster.set(r.squad_id, arr);
  }
  const OPEN = ["proposed", "approved", "on_hold", "active"];
  const backlog = new Map<string, SquadCard["backlog"]>();
  for (const b of ((backlogRes.data ?? []) as unknown as { squad_id: string; project: { id: string; name: string; wsjf: number; initiative_type: string; status: string } | null }[])) {
    if (!b.project || !OPEN.includes(b.project.status)) continue;
    const arr = backlog.get(b.squad_id) ?? [];
    arr.push({ id: b.project.id, name: b.project.name, wsjf: Number(b.project.wsjf ?? 0), type: b.project.initiative_type, status: b.project.status });
    backlog.set(b.squad_id, arr);
  }
  const poName = new Map<string, string>();
  for (const u of ((poRes.data ?? []) as { id: string; full_name: string | null; username: string | null; email: string | null }[])) {
    poName.set(u.id, u.full_name || u.username || u.email || "—");
  }

  return caps.map((c) => ({
    ...c,
    po_name: c.po_user_id ? (poName.get(c.po_user_id) ?? null) : null,
    roster: roster.get(c.id) ?? [],
    backlog: (backlog.get(c.id) ?? []).sort((a, b) => b.wsjf - a.wsjf).slice(0, 2),
  }));
}
