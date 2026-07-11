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
  due_date: string | null;
  incident: { id: string; incident_number: string } | null;
};

export type RiskData = {
  events: RiskEventRow[];
  stats: { open: number; estimatedTotal: number; actualTotal: number; overdue: number };
};

export async function listRiskEvents(supabase: SupabaseClient): Promise<RiskData> {
  const { data, error } = await supabase
    .from("risk_event")
    .select("id, event_number, risk_category, description, estimated_loss, actual_loss, recovered_amount, currency, status, due_date, incident:incident_id(id, incident_number)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const events = (data ?? []) as unknown as RiskEventRow[];
  const today = new Date().toISOString().slice(0, 10);
  return {
    events,
    stats: {
      open: events.filter((e) => e.status !== "closed").length,
      estimatedTotal: events.reduce((s, e) => s + Number(e.estimated_loss), 0),
      actualTotal: events.reduce((s, e) => s + Number(e.actual_loss), 0),
      overdue: events.filter((e) => e.status !== "closed" && e.due_date && e.due_date < today).length,
    },
  };
}

/** Evento de riesgo asociado a un caso (para mostrar el vínculo en el detalle). */
export async function getRiskEventForIncident(supabase: SupabaseClient, incidentId: string) {
  const { data } = await supabase.from("risk_event").select("id, event_number, status").eq("incident_id", incidentId).limit(1).maybeSingle();
  return data as { id: string; event_number: string; status: string } | null;
}
