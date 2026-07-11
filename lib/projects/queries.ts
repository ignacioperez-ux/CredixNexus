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
};

export async function listProjects(supabase: SupabaseClient): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from("project")
    .select("id, project_code, name, status, wsjf, estimated_benefit_amount, estimated_cost_amount, squad:squad_id(name), incident:created_from_incident_id(incident_number)")
    .order("wsjf", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProjectRow[];
}

/** ROI = (beneficio - costo) / costo, en %. Null si no hay costo. */
export function computeRoi(benefit: number, cost: number): number | null {
  if (!cost || cost <= 0) return benefit > 0 ? null : 0;
  return Math.round(((benefit - cost) / cost) * 100);
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
