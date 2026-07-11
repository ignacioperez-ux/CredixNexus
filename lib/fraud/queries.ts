import type { SupabaseClient } from "@supabase/supabase-js";
import { maskName } from "@/lib/fraud/validation";

// Fraude y Disputas. RLS aisla por tenant. Se une al incidente ancla para numero/titulo.
// PII (nombre de cliente) SIEMPRE enmascarada en listas (§3.1 #12).

export type FraudRow = {
  id: string; fraud_number: string; fraud_type: string; status: string; detection_source: string;
  risk_score: number | null; amount_exposed: number | null; amount_recovered: number; currency: string;
  incident_id: string; incident_number: string; title: string; customer_masked: string;
};
export type DisputeRow = {
  id: string; dispute_number: string; dispute_type: string; status: string; reason_code: string | null;
  disputed_amount: number | null; amount_recovered: number; currency: string; due_date: string | null;
  incident_id: string; incident_number: string; title: string; customer_masked: string;
};

export type FraudStats = { open: number; confirmed: number; exposed: number; recovered: number };
export type DisputeStats = { open: number; overdue: number; disputed: number; recovered: number };

const OPEN_FRAUD = ["reported", "investigating", "confirmed"];
const OPEN_DISPUTE = ["opened", "investigating", "awaiting_customer", "submitted"];

function incFields(row: Record<string, unknown>) {
  const inc = row.incident as { incident_number: string; title: string; customer_name: string | null } | null;
  return { incident_number: inc?.incident_number ?? "—", title: inc?.title ?? "—", customer_masked: maskName(inc?.customer_name) };
}

export async function listFraud(supabase: SupabaseClient): Promise<{ rows: FraudRow[]; stats: FraudStats }> {
  const { data, error } = await supabase
    .from("fraud_case")
    .select("id, fraud_number, fraud_type, status, detection_source, risk_score, amount_exposed, amount_recovered, currency, incident_id, incident:incident_id(incident_number, title, customer_name)")
    .order("reported_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows: FraudRow[] = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const f = incFields(row);
    delete row.incident;
    return { ...(row as unknown as Omit<FraudRow, "incident_number" | "title" | "customer_masked">), ...f };
  });
  return {
    rows,
    stats: {
      open: rows.filter((r) => OPEN_FRAUD.includes(r.status)).length,
      confirmed: rows.filter((r) => r.status === "confirmed" || r.status === "recovered").length,
      exposed: rows.reduce((s, r) => s + (r.amount_exposed ?? 0), 0),
      recovered: rows.reduce((s, r) => s + (r.amount_recovered ?? 0), 0),
    },
  };
}

export async function listDisputes(supabase: SupabaseClient): Promise<{ rows: DisputeRow[]; stats: DisputeStats }> {
  const { data, error } = await supabase
    .from("dispute_case")
    .select("id, dispute_number, dispute_type, status, reason_code, disputed_amount, amount_recovered, currency, due_date, incident_id, incident:incident_id(incident_number, title, customer_name)")
    .order("opened_at", { ascending: false });
  if (error) throw new Error(error.message);
  const today = new Date().toISOString().slice(0, 10);
  const rows: DisputeRow[] = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const f = incFields(row);
    delete row.incident;
    return { ...(row as unknown as Omit<DisputeRow, "incident_number" | "title" | "customer_masked">), ...f };
  });
  return {
    rows,
    stats: {
      open: rows.filter((r) => OPEN_DISPUTE.includes(r.status)).length,
      overdue: rows.filter((r) => OPEN_DISPUTE.includes(r.status) && r.due_date && r.due_date < today).length,
      disputed: rows.reduce((s, r) => s + (r.disputed_amount ?? 0), 0),
      recovered: rows.reduce((s, r) => s + (r.amount_recovered ?? 0), 0),
    },
  };
}

export async function getFraudCase(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("fraud_case")
    .select("*, incident:incident_id(id, incident_number, title, status, priority, customer_name, transaction_reference)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getDisputeCase(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("dispute_case")
    .select("*, incident:incident_id(id, incident_number, title, status, priority, customer_name, transaction_reference), processor:processor_vendor_id(name)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Caso financiero (fraude o disputa) anclado a un incidente — para el panel del incidente. */
export async function getFinancialCaseForIncident(supabase: SupabaseClient, incidentId: string): Promise<{ kind: "fraud" | "dispute"; id: string; number: string; status: string } | null> {
  const [{ data: f }, { data: d }] = await Promise.all([
    supabase.from("fraud_case").select("id, fraud_number, status").eq("incident_id", incidentId).maybeSingle(),
    supabase.from("dispute_case").select("id, dispute_number, status").eq("incident_id", incidentId).maybeSingle(),
  ]);
  if (f) return { kind: "fraud", id: f.id as string, number: f.fraud_number as string, status: f.status as string };
  if (d) return { kind: "dispute", id: d.id as string, number: d.dispute_number as string, status: d.status as string };
  return null;
}
