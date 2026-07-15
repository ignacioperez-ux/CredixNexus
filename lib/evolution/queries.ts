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

// Torre de Control: funnel + aging + salud (con items) + senales (RPC agregado).
export type FunnelStage = "candidates" | "rec_pending" | "rec_approved" | "in_evolution" | "proj_active" | "proj_done";
export type HealthItem = { id: string; code: string; name: string; kind: "blocked" | "at_risk" };
export type EvolutionHome = {
  funnel: Record<FunnelStage, number>;
  aging: Record<FunnelStage, number>;
  health: { blocked: number; at_risk: number; open_projects: number; items: HealthItem[] };
  signals: number;
};
export async function getEvolutionHome(supabase: SupabaseClient): Promise<EvolutionHome> {
  const { data, error } = await supabase.rpc("evolution_home");
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Partial<EvolutionHome>;
  return {
    funnel: (d.funnel ?? {}) as Record<FunnelStage, number>,
    aging: (d.aging ?? {}) as Record<FunnelStage, number>,
    health: { blocked: 0, at_risk: 0, open_projects: 0, items: [], ...(d.health ?? {}) },
    signals: d.signals ?? 0,
  };
}

// Bandeja de decisiones (gateada por permiso por seccion en el RPC).
export type DecisionKind = "mi_comm" | "cab" | "convert" | "signal" | "roi" | "kb";
export type DecisionItem = {
  kind: DecisionKind; rank: number; title?: string; code?: string | null; entity_id?: string;
  age_days?: number; severity: "red" | "amber"; link: string; count?: number;
};
export async function getEvolutionDecisions(supabase: SupabaseClient): Promise<DecisionItem[]> {
  const { data, error } = await supabase.rpc("evolution_decisions");
  if (error) throw new Error(error.message);
  return ((data ?? []) as DecisionItem[]).sort((a, b) => a.rank - b.rank || (b.age_days ?? 0) - (a.age_days ?? 0));
}
