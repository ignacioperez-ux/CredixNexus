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
