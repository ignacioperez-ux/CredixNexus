import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectRow = {
  id: string;
  project_code: string;
  name: string;
  status: string;
  wsjf: number;
  estimated_benefit_amount: number;
  estimated_cost_amount: number;
  squad: { name: string } | null;
  incident: { incident_number: string } | null;
  business_unit: { name: string } | null;
};

export async function listProjects(supabase: SupabaseClient): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from("project")
    .select("id, project_code, name, status, wsjf, estimated_benefit_amount, estimated_cost_amount, squad:squad_id(name), incident:created_from_incident_id(incident_number), business_unit:business_unit_id(name)")
    .order("wsjf", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProjectRow[];
}

/** Proyectos de evolucion nacidos de un incidente (ancla §0: la mesa conserva el hilo). */
export type IncidentProject = { id: string; project_code: string; name: string; status: string; squad: { name: string } | null };
export async function getProjectsForIncident(supabase: SupabaseClient, incidentId: string): Promise<IncidentProject[]> {
  const { data } = await supabase
    .from("project")
    .select("id, project_code, name, status, squad:squad_id(name)")
    .eq("created_from_incident_id", incidentId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as IncidentProject[];
}

/** ROI = (beneficio - costo) / costo, en %. Null si no hay costo. */
export function computeRoi(benefit: number, cost: number): number | null {
  if (!cost || cost <= 0) return benefit > 0 ? null : 0;
  return Math.round(((benefit - cost) / cost) * 100);
}

// ---- Portafolio (Fase Evolucion 1.4): cockpit estrategico -----------------------
export type PortfolioRow = {
  id: string; project_code: string; name: string; status: string; wsjf: number;
  business_value: number; time_criticality: number; risk_reduction: number; job_size: number;
  estimated_benefit_amount: number; estimated_cost_amount: number;
  actual_benefit_amount: number | null; actual_cost_amount: number | null;
  planned_start: string | null; planned_end: string | null;
  actual_start: string | null; actual_end: string | null;
  squad: { id: string; name: string } | null;
  business_unit: { name: string } | null;
};

export async function listPortfolio(supabase: SupabaseClient): Promise<PortfolioRow[]> {
  const { data, error } = await supabase
    .from("project")
    .select(`id, project_code, name, status, wsjf, business_value, time_criticality, risk_reduction, job_size,
      estimated_benefit_amount, estimated_cost_amount, actual_benefit_amount, actual_cost_amount,
      planned_start, planned_end, actual_start, actual_end,
      squad:squad_id(id, name), business_unit:business_unit_id(name)`)
    .order("wsjf", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PortfolioRow[];
}

/** Capacidad de squads activos (puntos). Demanda = suma de job_size comprometido (portfolio.ts). */
export type SquadCapacity = { id: string; name: string; capacity_points: number };
export async function listSquadCapacity(supabase: SupabaseClient): Promise<SquadCapacity[]> {
  const { data, error } = await supabase
    .from("squad")
    .select("id, name, capacity_points")
    .eq("status", "active")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({ id: s.id as string, name: s.name as string, capacity_points: Number(s.capacity_points ?? 0) }));
}

export async function getProject(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("project")
    .select(`*,
      squad:squad_id(name, is_transversal),
      business_unit:business_unit_id(name),
      area:delivery_area_id(name, code),
      incident:created_from_incident_id(id, incident_number, title, status)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Caso ancla (§0): la incidencia que origino el proyecto de evolucion. El Gerente de Evolucion
// NO tiene incident.read (no gestiona casos), pero la mesa conserva el hilo y el proyecto debe
// mostrar el CONTEXTO del caso y la comunicacion con el CLIENTE (comentarios visibles al partner),
// en SOLO LECTURA. RLS de incident/incident_comment es por tenant, asi que la proyeccion es segura.
export type AnchorCaseComment = { id: string; body: string; created_at: string; is_system_generated: boolean };
export type AnchorCase = {
  incident_number: string; title: string; status: string; priority: string;
  opened_at: string | null; resolved_at: string | null; comments: AnchorCaseComment[];
};

export async function getAnchorCaseContext(supabase: SupabaseClient, incidentId: string): Promise<AnchorCase | null> {
  const { data: inc } = await supabase
    .from("incident")
    .select("incident_number, title, status, priority, opened_at, resolved_at")
    .eq("id", incidentId)
    .maybeSingle();
  if (!inc) return null;
  const { data: comments } = await supabase
    .from("incident_comment")
    .select("id, body, created_at, is_system_generated")
    .eq("incident_id", incidentId)
    .eq("visibility", "partner")
    .order("created_at", { ascending: true })
    .limit(30);
  return {
    incident_number: inc.incident_number as string,
    title: inc.title as string,
    status: inc.status as string,
    priority: inc.priority as string,
    opened_at: (inc.opened_at as string | null) ?? null,
    resolved_at: (inc.resolved_at as string | null) ?? null,
    comments: (comments ?? []) as AnchorCaseComment[],
  };
}

export type ValidationRow = {
  id: string; name: string; test_type: string; environment: string; result: string;
  evidence_url: string | null; notes: string | null; run_at: string;
};

export async function getProjectValidations(supabase: SupabaseClient, projectId: string): Promise<ValidationRow[]> {
  const { data, error } = await supabase
    .from("project_validation")
    .select("id, name, test_type, environment, result, evidence_url, notes, run_at")
    .eq("project_id", projectId)
    .order("run_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ValidationRow[];
}

export async function getProjectTasks(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from("project_task")
    .select("id, title, status, priority, due_date, completed_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProjectOptions(supabase: SupabaseClient) {
  const [squads, businessUnits] = await Promise.all([
    supabase.from("squad").select("id, name").eq("status", "active").order("name"),
    supabase.from("business_unit").select("id, name").eq("status", "active").order("name"),
  ]);
  return {
    squads: (squads.data ?? []) as { id: string; name: string }[],
    businessUnits: (businessUnits.data ?? []) as { id: string; name: string }[],
  };
}

/** Recomendaciones aprobadas por el RC que aun no tienen proyecto (para convertir). */
export async function getConvertibleRecommendations(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("project_recommendation")
    .select("id, recommended_name, transformation_score, business_priority, incident:incident_id(incident_number)")
    .eq("recommendation_status", "approved")
    .is("created_project_id", null)
    .order("business_priority", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as {
    id: string;
    recommended_name: string;
    transformation_score: number;
    business_priority: number | null;
    incident: { incident_number: string } | null;
  }[];
}
