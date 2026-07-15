import type { SupabaseClient } from "@supabase/supabase-js";

const OPEN_INCIDENT = ["new", "triaged", "assigned", "in_progress", "waiting", "reopened", "in_evolution"];

export type MemberSquad = { name: string; is_transversal: boolean };
export type MemberLoad = {
  id: string;
  name: string;
  discipline: string | null;
  capacity_points: number;
  openIncidents: number;
  taskPoints: number;
  taskCount: number;
  squads: MemberSquad[];
};
export type SquadLoad = { id: string; name: string; capacity_points: number; allocatedPoints: number; is_transversal: boolean };
export type Workload = {
  members: MemberLoad[];
  squads: SquadLoad[];
  totals: { openIncidents: number; taskPoints: number; membersWithLoad: number; overCapacity: number };
};

export async function getWorkload(supabase: SupabaseClient): Promise<Workload> {
  const [membersRes, incRes, taskRes, projRes, squadRes, memberSquadRes] = await Promise.all([
    supabase.from("team_member").select("id, name, discipline, capacity_points").eq("status", "active").order("name"),
    supabase.from("incident").select("assigned_member_id, status"),
    supabase.from("project_task").select("assigned_member_id, effort_points, status, project_id"),
    supabase.from("project").select("id, squad_id"),
    supabase.from("squad").select("id, name, capacity_points, is_transversal").eq("status", "active"),
    supabase.from("squad_member").select("member_id, squad_id").eq("status", "active"),
  ]);

  const members = (membersRes.data ?? []) as { id: string; name: string; discipline: string | null; capacity_points: number }[];
  const incidents = (incRes.data ?? []) as { assigned_member_id: string | null; status: string }[];
  const tasks = (taskRes.data ?? []) as { assigned_member_id: string | null; effort_points: number; status: string; project_id: string }[];
  const projects = (projRes.data ?? []) as { id: string; squad_id: string | null }[];
  const squads = (squadRes.data ?? []) as { id: string; name: string; capacity_points: number; is_transversal: boolean }[];
  const memberships = (memberSquadRes.data ?? []) as { member_id: string; squad_id: string }[];

  const projSquad = new Map(projects.map((p) => [p.id, p.squad_id]));
  const squadById = new Map(squads.map((s) => [s.id, s]));
  // Squads (activos) por miembro; distingue "Equipo Transversal" (squad.is_transversal).
  const squadsByMember = new Map<string, MemberSquad[]>();
  for (const ms of memberships) {
    const sq = squadById.get(ms.squad_id);
    if (!sq) continue;
    const arr = squadsByMember.get(ms.member_id) ?? [];
    if (!arr.some((x) => x.name === sq.name)) arr.push({ name: sq.name, is_transversal: sq.is_transversal });
    squadsByMember.set(ms.member_id, arr);
  }

  const memberLoad: MemberLoad[] = members.map((m) => {
    const openIncidents = incidents.filter((i) => i.assigned_member_id === m.id && OPEN_INCIDENT.includes(i.status)).length;
    const openTasks = tasks.filter((tk) => tk.assigned_member_id === m.id && tk.status !== "done");
    const taskPoints = openTasks.reduce((s, tk) => s + (tk.effort_points ?? 0), 0);
    return { id: m.id, name: m.name, discipline: m.discipline, capacity_points: m.capacity_points, openIncidents, taskPoints, taskCount: openTasks.length, squads: squadsByMember.get(m.id) ?? [] };
  });

  const squadLoad: SquadLoad[] = squads.map((s) => {
    const allocatedPoints = tasks
      .filter((tk) => tk.status !== "done" && projSquad.get(tk.project_id) === s.id)
      .reduce((sum, tk) => sum + (tk.effort_points ?? 0), 0);
    return { id: s.id, name: s.name, capacity_points: s.capacity_points, allocatedPoints, is_transversal: s.is_transversal };
  });

  const totals = {
    openIncidents: memberLoad.reduce((s, m) => s + m.openIncidents, 0),
    taskPoints: memberLoad.reduce((s, m) => s + m.taskPoints, 0),
    membersWithLoad: memberLoad.filter((m) => m.openIncidents > 0 || m.taskPoints > 0).length,
    overCapacity: memberLoad.filter((m) => m.taskPoints > m.capacity_points).length,
  };

  return { members: memberLoad, squads: squadLoad, totals };
}
