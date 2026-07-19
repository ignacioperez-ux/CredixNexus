import type { SupabaseClient } from "@supabase/supabase-js";

// Capa analitica. La agregacion vive en la funcion SQL analytics_overview (RLS + tenant).

export type Overview = {
  incidents: { total: number; open: number; p1_open: number; p2_open: number; p3_open: number; p4_open: number; resolved_30d: number; mttr_hours: number; sla_breached: number; transformation_candidates: number; in_evolution: number };
  by_status: Record<string, number>;
  problems: { open: number; known_errors: number };
  changes: { open: number; pending_cab: number; scheduled: number; emergency: number };
  major_incidents: { active: number; sev1: number };
  risk: { open: number; estimated: number; actual: number };
  vendors: { active: number; critical: number };
  workflows: { running: number };
  escalations: { unack: number };
  csat: { responses: number; pending: number; avg: number; satisfied_pct: number };
  top_categories: { category: string; count: number }[];
  trend: { day: string; count: number }[];
};

export async function getOverview(supabase: SupabaseClient): Promise<Overview> {
  const { data, error } = await supabase.rpc("analytics_overview");
  if (error) throw new Error(error.message);
  return data as Overview;
}

// ---- Reincidencia y efectividad de fixes (Gerencia de Operaciones) --------------------
export type RecurrenceAnalytics = {
  window_days: number; total: number; recurrences: number; rate_pct: number;
  by_operator: { name: string; resolved: number; came_back: number; effectiveness_pct: number | null }[];
  by_category: { category: string; recurrences: number }[];
};

export async function getRecurrenceAnalytics(supabase: SupabaseClient, days = 90): Promise<RecurrenceAnalytics> {
  const { data, error } = await supabase.rpc("recurrence_analytics", { p_days: days });
  if (error) throw new Error(error.message);
  return data as RecurrenceAnalytics;
}

// ---- Analisis de comportamiento AGREGADO (Fase Evolucion 1.3) --------------------
// Sirve por RPC incident_behavior_analysis (SECURITY DEFINER + gate analytics.read +
// scope tenant). NUNCA devuelve casos individuales: solo agregados por dimension.
export const BEHAVIOR_DIMENSIONS = ["category", "product", "service", "business_unit", "channel", "process", "priority"] as const;
export type BehaviorDimension = (typeof BEHAVIOR_DIMENSIONS)[number];

export type BehaviorGroup = {
  key: string; label: string; total: number; open: number; resolved: number; mttr_hours: number;
  sla_breached: number; transformation_candidates: number; avg_transformation_score: number;
  financial_impact: number; partners: number; transactions: number; with_problem: number; momentum: number;
};
export type BehaviorSignal = {
  key: string; label: string; total: number; momentum: number; avg_transformation_score: number;
  transformation_candidates: number; with_problem: number; reason: string;
};
export type BehaviorAnalysis = {
  dimension: BehaviorDimension; window_weeks: number; total_incidents: number; open_incidents: number;
  groups_total: number; groups: BehaviorGroup[]; trend: { week: string; count: number }[];
  projection: { method: string; slope: number; next_week: number } | null; signals: BehaviorSignal[];
};

/** Normaliza una dimension arbitraria (query string) a una permitida. */
export function normalizeDimension(d: string | undefined): BehaviorDimension {
  return (BEHAVIOR_DIMENSIONS as readonly string[]).includes(d ?? "") ? (d as BehaviorDimension) : "category";
}

export async function getBehaviorAnalysis(supabase: SupabaseClient, dimension: BehaviorDimension, weeks: number): Promise<BehaviorAnalysis> {
  const { data, error } = await supabase.rpc("incident_behavior_analysis", { p_dimension: dimension, p_weeks: weeks });
  if (error) throw new Error(error.message);
  return data as BehaviorAnalysis;
}

export type Csat = { csat_avg: number; csat_responses: number; csat_satisfied_pct: number };
export type AreaMetric = Csat & { code: string; name: string; open_incidents: number; resolved_30d: number; mttr_hours: number; sla_breached: number; projects_active: number; qa_authorized: number };
export type SquadMetric = { name: string; members: number; allocation_pct: number; projects: number; qa_passed: number; qa_authorized: number };
export type PersonMetric = Csat & { name: string; is_external: boolean; discipline: string | null; assigned_open: number; resolved_total: number; mttr_hours: number; reopened: number; effort_minutes: number };
export type ServiceMetric = Csat & { code: string; name: string; criticality: string; open_incidents: number; resolved_30d: number; mttr_hours: number };
export type Performance = { by_area: AreaMetric[]; by_squad: SquadMetric[]; by_person: PersonMetric[]; by_service: ServiceMetric[] };

export async function getPerformance(supabase: SupabaseClient): Promise<Performance> {
  const { data, error } = await supabase.rpc("performance_metrics");
  if (error) throw new Error(error.message);
  return data as Performance;
}

// ---- Dashboard de Supervisor (Command Center) ----
export type Supervisor = {
  open: number; unassigned: number; overdue: number; waiting: number; reopened: number;
  aging: { bucket: string; count: number }[];
  by_status: Record<string, number>;
  tasks: { open: number; overdue: number };
  workload: { agent: string; open: number; overdue: number }[];
  quality: { resolved_30d: number; reopened: number; reopen_rate: number };
};

export async function getSupervisor(supabase: SupabaseClient): Promise<Supervisor> {
  const { data, error } = await supabase.rpc("supervisor_metrics");
  if (error) throw new Error(error.message);
  return data as Supervisor;
}

/** Inflow diario por categoria (ultimos N dias) para sparklines por fila. RLS por tenant, dato real. */
export async function getCategoryTrends(supabase: SupabaseClient, days = 14): Promise<Record<string, number[]>> {
  const startDay = new Date(Date.now() - (days - 1) * 86400000);
  startDay.setHours(0, 0, 0, 0);
  const { data } = await supabase.from("incident").select("category, opened_at").gte("opened_at", startDay.toISOString());
  const base = startDay.getTime();
  const out: Record<string, number[]> = {};
  ((data ?? []) as { category: string | null; opened_at: string }[]).forEach((r) => {
    const cat = r.category ?? "—";
    const idx = Math.floor((new Date(r.opened_at).getTime() - base) / 86400000);
    if (idx >= 0 && idx < days) (out[cat] ??= new Array(days).fill(0))[idx]++;
  });
  return out;
}

// ---- Reportes: datasets exportables (RLS filtra por tenant) --------------------
export type ReportDataset = "incidents" | "changes" | "risk" | "problems";

export type ReportResult = { columns: string[]; rows: (string | number | null)[][] };

export async function getReport(supabase: SupabaseClient, dataset: ReportDataset): Promise<ReportResult> {
  switch (dataset) {
    case "incidents": {
      const { data, error } = await supabase
        .from("incident")
        .select("incident_number, title, category, priority, status, case_type, opened_at, resolved_at")
        .order("opened_at", { ascending: false }).limit(1000);
      if (error) throw new Error(error.message);
      return {
        columns: ["number", "title", "category", "priority", "status", "case_type", "opened_at", "resolved_at"],
        rows: (data ?? []).map((r) => [r.incident_number, r.title, r.category, r.priority, r.status, r.case_type, r.opened_at, r.resolved_at]),
      };
    }
    case "changes": {
      const { data, error } = await supabase
        .from("change_request")
        .select("change_number, title, change_type, risk_level, status, cab_decision, planned_start, created_at")
        .order("created_at", { ascending: false }).limit(1000);
      if (error) throw new Error(error.message);
      return {
        columns: ["number", "title", "type", "risk", "status", "cab_decision", "planned_start", "created_at"],
        rows: (data ?? []).map((r) => [r.change_number, r.title, r.change_type, r.risk_level, r.status, r.cab_decision, r.planned_start, r.created_at]),
      };
    }
    case "risk": {
      const { data, error } = await supabase
        .from("risk_event")
        .select("event_number, risk_category, description, estimated_loss, actual_loss, currency, status, due_date")
        .order("created_at", { ascending: false }).limit(1000);
      if (error) throw new Error(error.message);
      return {
        columns: ["number", "category", "description", "estimated_loss", "actual_loss", "currency", "status", "due_date"],
        rows: (data ?? []).map((r) => [r.event_number, r.risk_category, r.description, r.estimated_loss, r.actual_loss, r.currency, r.status, r.due_date]),
      };
    }
    case "problems": {
      const { data, error } = await supabase
        .from("problem")
        .select("problem_number, title, category, priority, status, known_error, opened_at")
        .order("opened_at", { ascending: false }).limit(1000);
      if (error) throw new Error(error.message);
      return {
        columns: ["number", "title", "category", "priority", "status", "known_error", "opened_at"],
        rows: (data ?? []).map((r) => [r.problem_number, r.title, r.category, r.priority, r.status, String(r.known_error), r.opened_at]),
      };
    }
  }
}
