import type { SupabaseClient } from "@supabase/supabase-js";
import { getMyMemberId } from "@/lib/incidents/queries";

// Datos del MIEMBRO DE SQUAD, SIEMPRE acotados a la persona (assigned_member_id) y a sus squads
// vigentes (squad_member con valid_from/valid_to). NUNCA expone portafolio global, financieros,
// WSJF, carga de otras personas ni el hilo del caso ancla. Los maestros nuevos (chapters,
// objetivos, vinculo RC, calendario) no existen aun: se consumen si estan y degradan si no.

const DONE = "done";

export type MyTask = {
  id: string; title: string; status: string; priority: string; effort_points: number;
  due_date: string | null; project_id: string | null;
  initiative_code: string | null; initiative_name: string | null;
  squad_id: string | null; squad_code: string | null; squad_name: string | null;
  assigned_member_id?: string | null;
};

export type MySquad = {
  squad_id: string; code: string; name: string; squad_role: string;
  allocation_pct: number; capacity_points: number; squad_type: string | null; status: string; mission: string | null;
};

export type MyCapacity = { squad_id: string; code: string; name: string; allocation_pct: number; committed_points: number };

export type MyWork = {
  memberId: string | null;
  memberName: string | null;
  tasks: MyTask[];
  squads: MySquad[];
  capacity: MyCapacity[];
  totalAllocation: number;
  status: { doing: number; todo: number; blocked: number; dueThisWeek: number };
};

/** Squads vigentes de la persona (asignaciones activas cuya vigencia cubre hoy). */
export async function getMySquads(supabase: SupabaseClient, memberId: string): Promise<MySquad[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("squad_member")
    .select("squad_role, allocation_pct, valid_from, valid_to, status, squad:squad_id(id, code, name, capacity_points, squad_type, status, mission)")
    .eq("member_id", memberId)
    .eq("status", "active");
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { id: string; code: string; name: string; capacity_points: number; squad_type: string | null; status: string; mission: string | null } | null;
  return ((data ?? []) as { squad_role: string; allocation_pct: number; valid_from: string | null; valid_to: string | null; squad: unknown }[])
    .filter((r) => (!r.valid_from || r.valid_from <= today) && (!r.valid_to || r.valid_to >= today))
    .map((r) => {
      const s = one(r.squad);
      return {
        squad_id: s?.id ?? "", code: s?.code ?? "—", name: s?.name ?? "—", squad_role: r.squad_role,
        allocation_pct: Number(r.allocation_pct) || 0, capacity_points: Number(s?.capacity_points) || 0,
        squad_type: s?.squad_type ?? null, status: s?.status ?? "active", mission: s?.mission ?? null,
      };
    })
    .filter((s) => s.squad_id)
    .sort((a, b) => b.allocation_pct - a.allocation_pct);
}

/** Tareas de la persona (todas sus tareas, de todos sus squads) con el squad de origen. */
export async function getMyTasks(supabase: SupabaseClient, memberId: string): Promise<MyTask[]> {
  const { data } = await supabase
    .from("project_task")
    .select("id, title, status, priority, effort_points, due_date, project_id, project:project_id(name, project_code, squad_id, squad:squad_id(id, code, name))")
    .eq("assigned_member_id", memberId)
    .order("due_date", { ascending: true, nullsFirst: false });
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as Record<string, unknown> | null;
  return ((data ?? []) as Record<string, unknown>[]).map((t) => {
    const p = one(t.project);
    const sq = p ? one(p.squad) : null;
    return {
      id: t.id as string, title: t.title as string, status: (t.status as string) ?? "todo",
      priority: (t.priority as string) ?? "p3_medium", effort_points: Number(t.effort_points) || 0,
      due_date: (t.due_date as string | null) ?? null, project_id: (t.project_id as string | null) ?? null,
      initiative_code: (p?.project_code as string | null) ?? null, initiative_name: (p?.name as string | null) ?? null,
      squad_id: (sq?.id as string | null) ?? null, squad_code: (sq?.code as string | null) ?? null, squad_name: (sq?.name as string | null) ?? null,
    };
  });
}

/** Cockpit de "Mi trabajo": tareas + squads vigentes + capacidad multi-squad + linea de estado. */
export async function getMyWork(supabase: SupabaseClient, accountId: string | null, memberName: string | null = null): Promise<MyWork> {
  const memberId = await getMyMemberId(supabase, accountId);
  if (!memberId) return { memberId: null, memberName, tasks: [], squads: [], capacity: [], totalAllocation: 0, status: { doing: 0, todo: 0, blocked: 0, dueThisWeek: 0 } };

  const [squads, tasks] = await Promise.all([getMySquads(supabase, memberId), getMyTasks(supabase, memberId)]);

  const now = Date.now();
  const weekAhead = now + 7 * 86_400_000;
  const openTasks = tasks.filter((t) => t.status !== DONE);
  const status = {
    doing: tasks.filter((t) => t.status === "doing").length,
    todo: tasks.filter((t) => t.status === "todo").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
    dueThisWeek: openTasks.filter((t) => t.due_date && Date.parse(t.due_date) <= weekAhead && Date.parse(t.due_date) >= now - 86_400_000).length,
  };

  // Capacidad multi-squad: allocation vigente por squad + puntos comprometidos (tareas abiertas
  // cuyo squad de origen es ese squad).
  const capacity: MyCapacity[] = squads.map((s) => ({
    squad_id: s.squad_id, code: s.code, name: s.name, allocation_pct: s.allocation_pct,
    committed_points: openTasks.filter((t) => t.squad_id === s.squad_id).reduce((sum, t) => sum + t.effort_points, 0),
  }));
  const totalAllocation = squads.reduce((sum, s) => sum + s.allocation_pct, 0);

  return { memberId, memberName, tasks, squads, capacity, totalAllocation, status };
}

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as Record<string, unknown> | null;

// ---- §5 Mis Iniciativas: proyectos de mis squads, SIN financieros/WSJF/hilo del caso ----
export type MyInitiative = {
  project_id: string; code: string | null; name: string; status: string; health: string | null;
  squad_id: string | null; squad_code: string | null;
  mineDone: number; mineTotal: number; teamDone: number; teamTotal: number; nextDue: string | null;
};

export async function getMyInitiatives(supabase: SupabaseClient, memberId: string): Promise<MyInitiative[]> {
  const squads = await getMySquads(supabase, memberId);
  const squadIds = squads.map((s) => s.squad_id);
  if (squadIds.length === 0) return [];
  const codeById = new Map(squads.map((s) => [s.squad_id, s.code]));
  const { data: projs } = await supabase
    .from("project")
    .select("id, project_code, name, status, squad_id")
    .in("squad_id", squadIds);
  const projList = (projs ?? []) as { id: string; project_code: string | null; name: string; status: string; squad_id: string | null }[];
  if (projList.length === 0) return [];
  const { data: tasks } = await supabase
    .from("project_task")
    .select("project_id, status, assigned_member_id, due_date")
    .in("project_id", projList.map((p) => p.id));
  const tList = (tasks ?? []) as { project_id: string; status: string; assigned_member_id: string | null; due_date: string | null }[];
  return projList.map((p) => {
    const pt = tList.filter((x) => x.project_id === p.id);
    const mine = pt.filter((x) => x.assigned_member_id === memberId);
    const openDue = pt.filter((x) => x.status !== DONE && x.due_date).map((x) => x.due_date!).sort();
    return {
      project_id: p.id, code: p.project_code, name: p.name, status: p.status, health: null,
      squad_id: p.squad_id, squad_code: p.squad_id ? codeById.get(p.squad_id) ?? null : null,
      mineDone: mine.filter((x) => x.status === DONE).length, mineTotal: mine.length,
      teamDone: pt.filter((x) => x.status === DONE).length, teamTotal: pt.length,
      nextDue: openDue[0] ?? null,
    };
  }).sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
}

// ---- §6 Mi Perfil: asignaciones vigentes + competencias + evaluaciones (solo propias) ----
export type MyAssignment = { code: string; name: string; squad_role: string; allocation_pct: number; valid_from: string | null; valid_to: string | null };
export type MyProfile = {
  memberId: string | null; name: string | null; is_external: boolean; discipline: string | null; seniority: string | null;
  assignments: MyAssignment[];
  skills: { name: string; level: number }[];
  evaluations: { id: string; eval_type: string; performance_score: number | null; empathy_score: number | null; comment: string | null; strengths: string | null; development_areas: string | null; created_at: string }[];
};

export async function getMyProfile(supabase: SupabaseClient, accountId: string | null): Promise<MyProfile> {
  const memberId = await getMyMemberId(supabase, accountId);
  if (!memberId) return { memberId: null, name: null, is_external: false, discipline: null, seniority: null, assignments: [], skills: [], evaluations: [] };
  const today = new Date().toISOString().slice(0, 10);
  const [memRes, asgRes, skRes, evRes] = await Promise.all([
    supabase.from("team_member").select("name, is_external, discipline, seniority").eq("id", memberId).maybeSingle(),
    supabase.from("squad_member").select("squad_role, allocation_pct, valid_from, valid_to, status, squad:squad_id(code, name)").eq("member_id", memberId).eq("status", "active"),
    supabase.from("member_skill").select("level, skill:skill_id(name)").eq("member_id", memberId),
    supabase.from("member_evaluation").select("id, eval_type, performance_score, empathy_score, comment, strengths, development_areas, created_at").eq("member_id", memberId).order("created_at", { ascending: false }),
  ]);
  const mem = memRes.data as { name: string; is_external: boolean; discipline: string | null; seniority: string | null } | null;
  const assignments = ((asgRes.data ?? []) as { squad_role: string; allocation_pct: number; valid_from: string | null; valid_to: string | null; squad: unknown }[])
    .filter((r) => (!r.valid_from || r.valid_from <= today) && (!r.valid_to || r.valid_to >= today))
    .map((r) => { const s = one(r.squad); return { code: (s?.code as string) ?? "—", name: (s?.name as string) ?? "—", squad_role: r.squad_role, allocation_pct: Number(r.allocation_pct) || 0, valid_from: r.valid_from, valid_to: r.valid_to }; });
  const skills = ((skRes.data ?? []) as { level: number; skill: unknown }[]).map((s) => ({ name: (one(s.skill)?.name as string) ?? "—", level: s.level })).sort((a, b) => b.level - a.level);
  return {
    memberId, name: mem?.name ?? null, is_external: !!mem?.is_external, discipline: mem?.discipline ?? null, seniority: mem?.seniority ?? null,
    assignments, skills,
    evaluations: (evRes.data ?? []) as MyProfile["evaluations"],
  };
}

// ---- §4 Mi Squad: detalle acotado de un squad al que pertenezco ----
export type SquadRosterMember = { member_id: string; name: string; squad_role: string; allocation_pct: number; is_external: boolean; is_me: boolean };
export type MySquadDetail = {
  squad: { id: string; code: string; name: string; squad_type: string | null; status: string; mission: string | null } | null;
  myRole: string | null;
  roster: SquadRosterMember[];
  tasks: MyTask[];
};

export async function getMySquadDetail(supabase: SupabaseClient, memberId: string, squadId: string): Promise<MySquadDetail> {
  const [sqRes, rosRes, tkRes] = await Promise.all([
    supabase.from("squad").select("id, code, name, squad_type, status, mission").eq("id", squadId).maybeSingle(),
    supabase.from("squad_member").select("member_id, squad_role, allocation_pct, status, member:member_id(name, is_external)").eq("squad_id", squadId).eq("status", "active"),
    supabase.from("project_task").select("id, title, status, priority, effort_points, due_date, assigned_member_id, project:project_id!inner(name, project_code, squad_id, squad:squad_id(id, code, name))").eq("project.squad_id", squadId),
  ]);
  const squad = sqRes.data as MySquadDetail["squad"];
  const roster = ((rosRes.data ?? []) as { member_id: string; squad_role: string; allocation_pct: number; member: unknown }[]).map((r) => {
    const m = one(r.member);
    return { member_id: r.member_id, name: (m?.name as string) ?? "—", squad_role: r.squad_role, allocation_pct: Number(r.allocation_pct) || 0, is_external: !!(m?.is_external), is_me: r.member_id === memberId };
  }).sort((a, b) => (a.is_me ? -1 : b.is_me ? 1 : b.allocation_pct - a.allocation_pct));
  const myRole = roster.find((r) => r.is_me)?.squad_role ?? null;
  const tasks: MyTask[] = ((tkRes.data ?? []) as Record<string, unknown>[])
    .filter((t) => one(t.project)) // el filtro por project.squad_id puede traer nulls si no matchea
    .map((t) => {
      const p = one(t.project); const sq = p ? one(p.squad) : null;
      return {
        id: t.id as string, title: t.title as string, status: (t.status as string) ?? "todo", priority: (t.priority as string) ?? "p3_medium",
        effort_points: Number(t.effort_points) || 0, due_date: (t.due_date as string | null) ?? null, project_id: null,
        initiative_code: (p?.project_code as string | null) ?? null, initiative_name: (p?.name as string | null) ?? null,
        squad_id: (sq?.id as string | null) ?? null, squad_code: (sq?.code as string | null) ?? null, squad_name: (sq?.name as string | null) ?? null,
        assigned_member_id: (t.assigned_member_id as string | null) ?? null,
      } as MyTask & { assigned_member_id: string | null };
    });
  return { squad, myRole, roster, tasks };
}
