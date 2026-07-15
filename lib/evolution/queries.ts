import type { SupabaseClient } from "@supabase/supabase-js";

// Casos convertidos (trazabilidad incidencia -> mejora/proyecto). Se sirve por RPC
// converted_cases (SECURITY DEFINER + gate project.read/incident.read + tenant): el Gerente de
// Evolucion accede solo a los casos ya en su pipeline, sin incident.read del universo.
export type ConvertedCase = {
  id: string; incident_number: string; title: string; status: string; case_type: string | null; priority: string;
  opened_at: string | null; resolved_at: string | null; created_at: string; reporter: string | null;
  transformation_score: number; transformation_decision: string | null; financial_impact: number; partners: number;
  product: string | null; system: string | null; process: string | null; business_unit: string | null; channel: string | null; category: string | null;
  recommendation_status: string | null; project_code: string | null; project_name: string | null; project_status: string | null;
  converted_to: "candidate" | "improvement" | "project";
};

export async function getConvertedCases(supabase: SupabaseClient): Promise<ConvertedCase[]> {
  const { data, error } = await supabase.rpc("converted_cases");
  if (error) throw new Error(error.message);
  return (data ?? []) as ConvertedCase[];
}

// Home de Evolucion: funnel + salud + senales (RPC agregado).
export type EvolutionHome = {
  funnel: { candidates: number; rec_pending: number; rec_approved: number; in_evolution: number; proj_active: number; proj_done: number };
  health: { blocked: number; at_risk: number; open_projects: number };
  signals: number;
};
export async function getEvolutionHome(supabase: SupabaseClient): Promise<EvolutionHome> {
  const { data, error } = await supabase.rpc("evolution_home");
  if (error) throw new Error(error.message);
  return (data ?? { funnel: {}, health: {}, signals: 0 }) as EvolutionHome;
}
