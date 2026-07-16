import type { SupabaseClient } from "@supabase/supabase-js";

// Torre de Control de Operaciones (mesa de ayuda / ITSM). Decision primero, inventario despues.
// Todo dato REAL y agregado en servidor desde tablas existentes (incident, major_incident,
// case_survey) via el cliente RLS-scoped del contexto. No hay RPC nuevo: composicion de lecturas.
// Enums reales verificados: status ∈ new|triaged|assigned|in_progress|resolved|in_evolution;
// priority ∈ p1_critical|p2_high|p3_medium|p4_low; intake_status ∈ pending|accepted.

const CLOSED = ["resolved", "closed", "cancelled"];
const CRIT = ["p1_critical", "p2_high"];
const DERIVED = ["to_evolution", "approved_to_evolution"];
const PIPELINE_STAGES = ["new", "triaged", "assigned", "in_progress", "resolved", "in_evolution"] as const;

export type OpsStatusLine = {
  pendingIntake: number; unassigned: number; unassignedCrit: number;
  slaBreached: number; miCommOverdue: number; inEvolution: number;
};
export type OpsDecisionKind = "mi_comm" | "sla_breach" | "intake" | "assign" | "derive";
export type OpsDecision = {
  kind: OpsDecisionKind; rank: number; severity: "red" | "amber"; count: number;
  link: string; oldestDays?: number;
};
export type OpsPipelineStage = { key: string; count: number; maxAgeDays: number };
export type OpsKpis = {
  slaCompliancePct: number | null; backlogOpen: number; unassignedPct: number | null;
  mttrHours: number | null; csat: number | null;
};
export type OperationsTower = {
  status: OpsStatusLine; decisions: OpsDecision[]; pipeline: OpsPipelineStage[]; kpis: OpsKpis;
};

type IncRow = {
  id: string; status: string; priority: string; intake_status: string | null;
  assigned_user_id: string | null; assigned_member_id: string | null;
  opened_at: string | null; resolved_at: string | null; sla_resolution_due_at: string | null;
  transformation_candidate: boolean | null; transformation_decision: string | null;
};

export async function getOperationsTower(supabase: SupabaseClient): Promise<OperationsTower> {
  const now = Date.now();
  const [incRes, miRes, surveyRes] = await Promise.all([
    supabase.from("incident").select(
      "id, status, priority, intake_status, assigned_user_id, assigned_member_id, opened_at, resolved_at, sla_resolution_due_at, transformation_candidate, transformation_decision",
    ),
    supabase.from("major_incident").select("id, status, next_update_due_at"),
    supabase.from("case_survey").select("score, submitted_at"),
  ]);
  if (incRes.error) throw new Error(incRes.error.message);

  const inc = (incRes.data ?? []) as IncRow[];
  const ageDays = (d: string | null) => (d ? Math.floor((now - Date.parse(d)) / 86_400_000) : 0);
  const unassigned = (i: IncRow) => !i.assigned_user_id && !i.assigned_member_id;
  const isOpen = (i: IncRow) => !CLOSED.includes(i.status) && i.status !== "in_evolution";

  const pending = inc.filter((i) => i.intake_status === "pending" && !CLOSED.includes(i.status));
  const openList = inc.filter(isOpen);
  const unassignedList = openList.filter(unassigned);
  const unassignedCritList = unassignedList.filter((i) => CRIT.includes(i.priority));
  const slaBreachedList = openList.filter((i) => i.sla_resolution_due_at && Date.parse(i.sla_resolution_due_at) < now);
  const deriveList = inc.filter(
    (i) => i.transformation_candidate === true && !CLOSED.includes(i.status) && i.status !== "in_evolution"
      && !DERIVED.includes(i.transformation_decision ?? ""),
  );
  const inEvolution = inc.filter((i) => i.status === "in_evolution").length;

  // Major incidents con comunicacion vencida (next_update_due_at en el pasado y aun activos).
  const miList = (miRes.data ?? []) as { id: string; status: string; next_update_due_at: string | null }[];
  const miOverdue = miList.filter(
    (m) => !["resolved", "stood_down", "closed"].includes(m.status)
      && m.next_update_due_at && Date.parse(m.next_update_due_at) < now,
  );

  const status: OpsStatusLine = {
    pendingIntake: pending.length, unassigned: unassignedList.length, unassignedCrit: unassignedCritList.length,
    slaBreached: slaBreachedList.length, miCommOverdue: miOverdue.length, inEvolution,
  };

  // Bandeja priorizada: MI > SLA vencido > admitir > asignar > derivar. Cada item navega con filtro.
  const decisions: OpsDecision[] = [];
  if (miOverdue.length) decisions.push({ kind: "mi_comm", rank: 1, severity: "red", count: miOverdue.length, link: "/major-incidents" });
  if (slaBreachedList.length) decisions.push({ kind: "sla_breach", rank: 2, severity: "red", count: slaBreachedList.length, link: "/sla-governance" });
  const intakeAging = pending.filter((i) => ageDays(i.opened_at) >= 1);
  if (intakeAging.length) {
    decisions.push({ kind: "intake", rank: 3, severity: "amber", count: intakeAging.length, link: "/triage", oldestDays: Math.max(...pending.map((i) => ageDays(i.opened_at))) });
  }
  if (unassignedCritList.length) decisions.push({ kind: "assign", rank: 4, severity: "red", count: unassignedCritList.length, link: "/incidents" });
  if (deriveList.length) decisions.push({ kind: "derive", rank: 5, severity: "amber", count: deriveList.length, link: "/incidents?view=candidates" });
  decisions.sort((a, b) => a.rank - b.rank);

  const pipeline: OpsPipelineStage[] = PIPELINE_STAGES.map((k) => {
    const rows = inc.filter((i) => i.status === k);
    return { key: k, count: rows.length, maxAgeDays: rows.reduce((m, i) => Math.max(m, ageDays(i.opened_at)), 0) };
  });

  // KPIs ITSM desde datos existentes.
  const withDue = inc.filter((i) => i.sla_resolution_due_at);
  const met = withDue.filter((i) => {
    const due = Date.parse(i.sla_resolution_due_at as string);
    return i.resolved_at ? Date.parse(i.resolved_at) <= due : now <= due;
  });
  const resolved30 = inc.filter((i) => i.resolved_at && i.opened_at && now - Date.parse(i.resolved_at) <= 30 * 86_400_000);
  const mttrH = resolved30.length
    ? resolved30.reduce((s, i) => s + (Date.parse(i.resolved_at as string) - Date.parse(i.opened_at as string)), 0) / resolved30.length / 3_600_000
    : null;
  const subs = ((surveyRes.data ?? []) as { score: number | null; submitted_at: string | null }[])
    .filter((s) => s.submitted_at != null && s.score != null);
  const csat = subs.length ? subs.reduce((s, x) => s + Number(x.score), 0) / subs.length : null;

  const kpis: OpsKpis = {
    slaCompliancePct: withDue.length ? Math.round((met.length / withDue.length) * 100) : null,
    backlogOpen: openList.length,
    unassignedPct: openList.length ? Math.round((unassignedList.length / openList.length) * 100) : null,
    mttrHours: mttrH != null ? Math.round(mttrH * 10) / 10 : null,
    csat: csat != null ? Math.round(csat * 10) / 10 : null,
  };

  return { status, decisions, pipeline, kpis };
}
