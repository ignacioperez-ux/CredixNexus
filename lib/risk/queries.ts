import type { SupabaseClient } from "@supabase/supabase-js";

export type RiskEventRow = {
  id: string;
  event_number: string;
  risk_category: string;
  description: string;
  estimated_loss: number;
  actual_loss: number;
  recovered_amount: number;
  currency: string;
  status: string;
  event_date: string | null;
  due_date: string | null;
  action_plan: string | null;
  owner: string | null;
  incident: { id: string; incident_number: string } | null;
};

export type RiskData = {
  events: RiskEventRow[];
  stats: {
    total: number; open: number; estimatedTotal: number; actualTotal: number; recoveredTotal: number;
    delta: number; overdue: number; mitigatedPct: number | null;
  };
};

// "Mitigado" = con avance de tratamiento (mitigando/cerrado/aceptado).
const MITIGATED = ["mitigating", "closed", "accepted"];

export async function listRiskEvents(supabase: SupabaseClient): Promise<RiskData> {
  const { data, error } = await supabase
    .from("risk_event")
    .select("id, event_number, risk_category, description, estimated_loss, actual_loss, recovered_amount, currency, status, event_date, due_date, action_plan, incident:incident_id(id, incident_number), owner:owner_user_id(full_name)")
    .order("event_date", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  const one = (v: unknown): { full_name: string } | null => (Array.isArray(v) ? (v[0] ?? null) : (v as { full_name: string } | null));
  const events: RiskEventRow[] = (data ?? []).map((e) => ({
    id: e.id as string,
    event_number: e.event_number as string,
    risk_category: e.risk_category as string,
    description: e.description as string,
    estimated_loss: Number(e.estimated_loss),
    actual_loss: Number(e.actual_loss),
    recovered_amount: Number(e.recovered_amount),
    currency: e.currency as string,
    status: e.status as string,
    event_date: (e.event_date as string | null) ?? null,
    due_date: (e.due_date as string | null) ?? null,
    action_plan: (e.action_plan as string | null) ?? null,
    owner: one(e.owner)?.full_name ?? null,
    incident: (Array.isArray(e.incident) ? e.incident[0] : e.incident) as RiskEventRow["incident"],
  }));
  const today = new Date().toISOString().slice(0, 10);
  const total = events.length;
  const mitigated = events.filter((e) => MITIGATED.includes(e.status)).length;
  const estimatedTotal = events.reduce((s, e) => s + e.estimated_loss, 0);
  const actualTotal = events.reduce((s, e) => s + e.actual_loss, 0);
  return {
    events,
    stats: {
      total,
      open: events.filter((e) => e.status !== "closed").length,
      estimatedTotal,
      actualTotal,
      recoveredTotal: events.reduce((s, e) => s + e.recovered_amount, 0),
      delta: actualTotal - estimatedTotal,
      overdue: events.filter((e) => e.status !== "closed" && e.due_date && e.due_date < today).length,
      mitigatedPct: total ? Math.round((mitigated / total) * 100) : null,
    },
  };
}

/** Evento de riesgo asociado a un caso (para mostrar el vínculo en el detalle). */
export async function getRiskEventForIncident(supabase: SupabaseClient, incidentId: string) {
  const { data } = await supabase.from("risk_event").select("id, event_number, status").eq("incident_id", incidentId).limit(1).maybeSingle();
  return data as { id: string; event_number: string; status: string } | null;
}
