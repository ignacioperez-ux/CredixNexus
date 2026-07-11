import type { SupabaseClient } from "@supabase/supabase-js";

// Observability Center. RLS aisla por tenant; consultas acotadas al contexto.
// Alertas de monitoreo (sensor -> caso) + eventos de experiencia digital (journeys).

export type AlertRow = {
  id: string;
  source: string;
  alert_type: string | null;
  severity: string;
  title: string;
  affected_system: string | null;
  affected_api: string | null;
  status: string;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  correlated_case_id: string | null;
  correlated_number: string | null;
  vendor_name: string | null;
  service_name: string | null;
};

export type AlertStats = { open: number; critical: number; acknowledged: number; correlated: number };
export type AlertData = { alerts: AlertRow[]; stats: AlertStats };

export async function listAlerts(supabase: SupabaseClient): Promise<AlertData> {
  const { data, error } = await supabase
    .from("monitoring_alert")
    .select(
      "id, source, alert_type, severity, title, affected_system, affected_api, status, occurrence_count, first_seen_at, last_seen_at, correlated_case_id, correlated:correlated_case_id(incident_number), vendor:vendor_id(name), service:affected_service_id(name)",
    )
    .order("last_seen_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const alerts: AlertRow[] = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const corr = row.correlated as { incident_number: string } | null;
    const vnd = row.vendor as { name: string } | null;
    const svc = row.service as { name: string } | null;
    delete row.correlated; delete row.vendor; delete row.service;
    return {
      ...(row as unknown as Omit<AlertRow, "correlated_number" | "vendor_name" | "service_name">),
      correlated_number: corr?.incident_number ?? null,
      vendor_name: vnd?.name ?? null,
      service_name: svc?.name ?? null,
    };
  });

  return {
    alerts,
    stats: {
      open: alerts.filter((a) => a.status === "open").length,
      critical: alerts.filter((a) => a.severity === "critical" && a.status !== "resolved").length,
      acknowledged: alerts.filter((a) => a.status === "acknowledged").length,
      correlated: alerts.filter((a) => a.status === "correlated").length,
    },
  };
}

export async function getAlert(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("monitoring_alert")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// ---- Experiencia digital (journeys) --------------------------------------------
export type DxRow = {
  id: string;
  channel: string;
  journey_name: string | null;
  step_name: string | null;
  user_type: string | null;
  device_type: string | null;
  app_version: string | null;
  status: string;
  response_time_ms: number | null;
  error_code: string | null;
  occurred_at: string;
};

export type DxJourney = { journey: string; total: number; errors: number; slow: number; error_pct: number; avg_ms: number };
export type DxStats = { events: number; error_pct: number; slow_pct: number; avg_ms: number };
export type DxData = { events: DxRow[]; stats: DxStats; byJourney: DxJourney[] };

export async function listDxEvents(supabase: SupabaseClient): Promise<DxData> {
  const { data, error } = await supabase
    .from("digital_experience_event")
    .select("id, channel, journey_name, step_name, user_type, device_type, app_version, status, response_time_ms, error_code, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const events = (data ?? []) as DxRow[];

  const total = events.length;
  const errors = events.filter((e) => e.status === "error").length;
  const slow = events.filter((e) => e.status === "slow").length;
  const timed = events.filter((e) => typeof e.response_time_ms === "number" && (e.response_time_ms as number) > 0);
  const avg = timed.length ? Math.round(timed.reduce((s, e) => s + (e.response_time_ms as number), 0) / timed.length) : 0;

  const jmap = new Map<string, { total: number; errors: number; slow: number; ms: number; timed: number }>();
  for (const e of events) {
    const key = e.journey_name ?? "—";
    const g = jmap.get(key) ?? { total: 0, errors: 0, slow: 0, ms: 0, timed: 0 };
    g.total += 1;
    if (e.status === "error") g.errors += 1;
    if (e.status === "slow") g.slow += 1;
    if (typeof e.response_time_ms === "number" && e.response_time_ms > 0) { g.ms += e.response_time_ms; g.timed += 1; }
    jmap.set(key, g);
  }
  const byJourney: DxJourney[] = [...jmap.entries()]
    .map(([journey, g]) => ({
      journey,
      total: g.total,
      errors: g.errors,
      slow: g.slow,
      error_pct: g.total ? Math.round((g.errors / g.total) * 100) : 0,
      avg_ms: g.timed ? Math.round(g.ms / g.timed) : 0,
    }))
    .sort((a, b) => b.error_pct - a.error_pct || b.total - a.total);

  return {
    events,
    byJourney,
    stats: {
      events: total,
      error_pct: total ? Math.round((errors / total) * 100) : 0,
      slow_pct: total ? Math.round((slow / total) * 100) : 0,
      avg_ms: avg,
    },
  };
}
