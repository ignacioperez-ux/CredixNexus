import type { SupabaseClient } from "@supabase/supabase-js";
import { getMyMemberId } from "@/lib/incidents/queries";
import { clockView, type RiskBucket } from "@/lib/sla/thresholds";

// Datos del OPERADOR, SIEMPRE acotados a la persona (assigned_member_id / assigned_user_id). Cero
// datos globales de la mesa. SLA con clockView (semaforo + tiempo humano, sin % crudo).

const OPEN = ["new", "triaged", "assigned", "in_progress", "waiting", "reopened"];
const SETTLED = ["resolved", "closed", "cancelled"];

const SEL = "id, incident_number, title, priority, status, case_type, opened_at, first_response_at, resolved_at, sla_response_due_at, sla_resolution_due_at, assigned_member_id, assigned_user_id, customer_name, pii_flag, category:category_id(name), ci:affected_ci_id(name)";

export type OpCase = {
  id: string; number: string; title: string; priority: string; status: string; case_type: string;
  opened_at: string; resolved_at: string | null; customer: string | null; app: string | null; category: string | null;
  respDueAt: string | null; resoDueAt: string | null;
  bucket: RiskBucket; overdueMs: number | null; dueAt: string | null; settled: boolean;
};

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as Record<string, unknown> | null;

function toCase(i: Record<string, unknown>, now: number): OpCase {
  const status = (i.status as string) ?? "new";
  const settled = SETTLED.includes(status) || status === "in_evolution";
  const stopped = settled ? ((i.resolved_at as string | null) ?? null) : null;
  const reso = clockView(i.opened_at as string, i.sla_resolution_due_at as string | null, stopped, now);
  return {
    id: i.id as string, number: i.incident_number as string, title: i.title as string,
    priority: (i.priority as string) ?? "p3_medium", status, case_type: (i.case_type as string) ?? "incident",
    opened_at: i.opened_at as string, resolved_at: (i.resolved_at as string | null) ?? null,
    customer: (i.customer_name as string | null) ?? null, app: (one(i.ci)?.name as string | null) ?? null,
    category: (one(i.category)?.name as string | null) ?? null,
    respDueAt: (i.sla_response_due_at as string | null) ?? null, resoDueAt: (i.sla_resolution_due_at as string | null) ?? null,
    bucket: reso.bucket, overdueMs: reso.overdueMs, dueAt: i.sla_resolution_due_at as string | null, settled,
  };
}

async function myIncidents(supabase: SupabaseClient, memberId: string | null, accountId: string | null): Promise<Record<string, unknown>[]> {
  if (!memberId && !accountId) return [];
  const ors: string[] = [];
  if (memberId) ors.push(`assigned_member_id.eq.${memberId}`);
  if (accountId) ors.push(`assigned_user_id.eq.${accountId}`);
  const { data } = await supabase.from("incident").select(SEL).or(ors.join(",")).order("opened_at", { ascending: true });
  return (data ?? []) as Record<string, unknown>[];
}

// Orden determinista de urgencia (§B "siguiente mejor accion"): 1) vencido mas antiguo, 2) vence
// antes, 3) prioridad. Solo sobre casos abiertos.
const PRIO_RANK: Record<string, number> = { p1_critical: 0, p2_high: 1, p3_medium: 2, p4_low: 3 };
function urgencyKey(c: OpCase): [number, number, number] {
  const overdue = c.overdueMs != null ? c.overdueMs : -1;          // vencido -> mayor primero
  const dueIn = c.dueAt ? Date.parse(c.dueAt) : Number.MAX_SAFE_INTEGER; // vence antes -> menor primero
  return [overdue > 0 ? 0 : 1, overdue > 0 ? -overdue : dueIn, PRIO_RANK[c.priority] ?? 9];
}
function sortUrgent(cases: OpCase[]): OpCase[] {
  return [...cases].sort((a, b) => {
    const ka = urgencyKey(a), kb = urgencyKey(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
  });
}

export type OpDay = {
  memberId: string | null; name: string | null; capacity: number;
  cases: OpCase[]; open: OpCase[];
  status: { active: number; dueToday: number; overdue: number; atRisk: number; worst: RiskBucket };
  nextBest: OpCase | null;
  kpis: { active: number; byStatus: Record<string, number>; dueToday: number; overdue: number; resolvedWeek: number; resolvedPrevWeek: number; util: number | null };
  week: { day: string; count: number }[];
  byPriority: { key: string; count: number }[];
};

const BR: Record<RiskBucket, number> = { na: 0, ok: 1, warning: 2, critical: 3, breached: 4 };

export async function getMyDay(supabase: SupabaseClient, accountId: string | null, name: string | null): Promise<OpDay> {
  const memberId = await getMyMemberId(supabase, accountId);
  const rows = await myIncidents(supabase, memberId, accountId);
  const now = Date.now();
  const cases = rows.map((r) => toCase(r, now));
  const open = cases.filter((c) => !c.settled);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const dueToday = open.filter((c) => c.dueAt && Date.parse(c.dueAt) <= todayEnd.getTime() && (c.overdueMs == null)).length;
  const overdue = open.filter((c) => c.overdueMs != null).length;
  const atRisk = open.filter((c) => c.bucket === "warning" || c.bucket === "critical" || c.bucket === "breached").length;
  const worst = open.reduce<RiskBucket>((w, c) => (BR[c.bucket] > BR[w] ? c.bucket : w), "ok");

  const capRow = memberId ? await supabase.from("team_member").select("capacity_points").eq("id", memberId).maybeSingle() : null;
  const capacity = Number(capRow?.data?.capacity_points) || 0;

  const weekAgo = now - 7 * 86_400_000;
  const prevWeekStart = now - 14 * 86_400_000;
  const resolvedWeek = cases.filter((c) => c.resolved_at && Date.parse(c.resolved_at) >= weekAgo).length;
  const resolvedPrevWeek = cases.filter((c) => c.resolved_at && Date.parse(c.resolved_at) >= prevWeekStart && Date.parse(c.resolved_at) < weekAgo).length;

  const byStatus: Record<string, number> = {};
  for (const c of open) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;

  // Resueltos por dia (14d)
  const week: { day: string; count: number }[] = [];
  for (let d = 13; d >= 0; d--) {
    const start = new Date(now - d * 86_400_000); start.setHours(0, 0, 0, 0);
    const end = start.getTime() + 86_400_000;
    week.push({ day: start.toISOString().slice(0, 10), count: cases.filter((c) => c.resolved_at && Date.parse(c.resolved_at) >= start.getTime() && Date.parse(c.resolved_at) < end).length });
  }
  const byPriority = ["p1_critical", "p2_high", "p3_medium", "p4_low"].map((k) => ({ key: k, count: open.filter((c) => c.priority === k).length })).filter((x) => x.count > 0);

  return {
    memberId, name, capacity, cases, open,
    status: { active: open.length, dueToday, overdue, atRisk, worst },
    nextBest: sortUrgent(open)[0] ?? null,
    kpis: { active: open.length, byStatus, dueToday, overdue, resolvedWeek, resolvedPrevWeek, util: capacity > 0 ? Math.round((open.length / capacity) * 100) : null },
    week, byPriority,
  };
}

/** §C1 Mis casos: lista completa (activos e historicos) ordenada por riesgo de SLA. */
export async function getMyCases(supabase: SupabaseClient, accountId: string | null): Promise<OpCase[]> {
  const memberId = await getMyMemberId(supabase, accountId);
  const rows = await myIncidents(supabase, memberId, accountId);
  const now = Date.now();
  return rows.map((r) => toCase(r, now)).sort((a, b) => BR[b.bucket] - BR[a.bucket]);
}

/** §C2 Cola del equipo (SOLO LECTURA): sin asignar + asignados a otros. Sin datos accionables. */
export type QueueCase = OpCase & { owner: string | null; assigned: boolean };
export async function getTeamQueue(supabase: SupabaseClient, accountId: string | null): Promise<{ unassigned: QueueCase[]; others: QueueCase[] }> {
  const memberId = await getMyMemberId(supabase, accountId);
  const { data } = await supabase
    .from("incident")
    .select(`${SEL}, assignee:assigned_member_id(name)`)
    .in("status", OPEN)
    .order("opened_at", { ascending: true });
  const now = Date.now();
  const all = ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const c = toCase(r, now) as QueueCase & { _mine: boolean };
    c.owner = (one(r.assignee)?.name as string | null) ?? null;
    c.assigned = !!r.assigned_member_id;
    c._mine = (!!memberId && r.assigned_member_id === memberId) || r.assigned_user_id === accountId;
    return c;
  });
  return {
    unassigned: all.filter((c) => !c.assigned),
    others: all.filter((c) => c.assigned && !c._mine), // asignados a OTROS (excluye los propios)
  };
}

// ---- §C3 Mi desempeno ----
export type OpPerformance = {
  memberId: string | null; name: string | null; capacity: number; activeLoad: number; util: number | null;
  sla: { compliancePct: number | null; mttrHours: number | null; resolved30: number };
  csat: { avg: number | null; count: number; recent: { score: number; comment: string | null; at: string }[] };
  evaluations: { id: string; performance_score: number | null; empathy_score: number | null; comment: string | null; strengths: string | null; development_areas: string | null; created_at: string }[];
  skills: { name: string; level: number }[];
};

export async function getMyPerformance(supabase: SupabaseClient, accountId: string | null, name: string | null): Promise<OpPerformance> {
  const memberId = await getMyMemberId(supabase, accountId);
  const rows = await myIncidents(supabase, memberId, accountId);
  const now = Date.now();
  const cases = rows.map((r) => toCase(r, now));
  const ids = cases.map((c) => c.id);

  const withDue = cases.filter((c) => c.resoDueAt);
  const met = withDue.filter((c) => c.resolved_at ? Date.parse(c.resolved_at) <= Date.parse(c.resoDueAt as string) : now <= Date.parse(c.resoDueAt as string));
  const resolved30 = cases.filter((c) => c.resolved_at && now - Date.parse(c.resolved_at) <= 30 * 86_400_000);
  const mttr = resolved30.length ? resolved30.reduce((s, c) => s + (Date.parse(c.resolved_at as string) - Date.parse(c.opened_at)), 0) / resolved30.length / 3_600_000 : null;

  const [csatRes, evalRes, skillRes, capRes] = await Promise.all([
    ids.length ? supabase.from("case_survey").select("score, comment, submitted_at, incident_id").in("incident_id", ids).not("submitted_at", "is", null) : Promise.resolve({ data: [] }),
    memberId ? supabase.from("member_evaluation").select("id, performance_score, empathy_score, comment, strengths, development_areas, created_at").eq("member_id", memberId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    memberId ? supabase.from("member_skill").select("level, skill:skill_id(name)").eq("member_id", memberId) : Promise.resolve({ data: [] }),
    memberId ? supabase.from("team_member").select("capacity_points").eq("id", memberId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const csatRows = ((csatRes.data ?? []) as { score: number | null; comment: string | null; submitted_at: string }[]).filter((s) => s.score != null);
  const capacity = Number((capRes.data as { capacity_points?: number } | null)?.capacity_points) || 0;
  const activeLoad = cases.filter((c) => !c.settled).length;

  return {
    memberId, name, capacity, activeLoad, util: capacity > 0 ? Math.round((activeLoad / capacity) * 100) : null,
    sla: { compliancePct: withDue.length ? Math.round((met.length / withDue.length) * 100) : null, mttrHours: mttr != null ? Math.round(mttr * 10) / 10 : null, resolved30: resolved30.length },
    csat: {
      avg: csatRows.length ? Math.round((csatRows.reduce((s, x) => s + Number(x.score), 0) / csatRows.length) * 10) / 10 : null,
      count: csatRows.length,
      recent: csatRows.slice(0, 5).map((x) => ({ score: Number(x.score), comment: x.comment, at: x.submitted_at })),
    },
    evaluations: (evalRes.data ?? []) as OpPerformance["evaluations"],
    skills: ((skillRes.data ?? []) as { level: number; skill: unknown }[]).map((s) => ({ name: (one(s.skill)?.name as string) ?? "—", level: s.level })).sort((a, b) => b.level - a.level),
  };
}
