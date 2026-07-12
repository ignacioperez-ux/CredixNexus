import type { SupabaseClient } from "@supabase/supabase-js";

// Gestion de Cambios. RLS aisla por tenant; consultas acotadas al contexto.

export type ChangeRow = {
  id: string;
  change_number: string;
  title: string;
  change_type: string;
  risk_level: string;
  status: string;
  planned_start: string | null;
  related_incident_id: string | null;
  related_problem_id: string | null;
  assignee: { full_name: string } | null;
};

export type ChangeStats = { open: number; pendingCab: number; scheduled: number; emergency: number };
export type ChangeData = { changes: ChangeRow[]; stats: ChangeStats };

const OPEN = ["draft", "assessment", "pending_cab", "approved", "scheduled", "implementing", "review"];

export async function listChanges(supabase: SupabaseClient): Promise<ChangeData> {
  const { data, error } = await supabase
    .from("change_request")
    .select("id, change_number, title, change_type, risk_level, status, planned_start, related_incident_id, related_problem_id, assignee:assigned_to(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const changes = (data ?? []) as unknown as ChangeRow[];
  return {
    changes,
    stats: {
      open: changes.filter((c) => OPEN.includes(c.status)).length,
      pendingCab: changes.filter((c) => c.status === "pending_cab").length,
      scheduled: changes.filter((c) => c.status === "scheduled").length,
      emergency: changes.filter((c) => c.change_type === "emergency" && OPEN.includes(c.status)).length,
    },
  };
}

export async function getChange(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("change_request")
    .select(`*,
      ci:affected_ci_id(name, ci_type),
      service:affected_service_id(name),
      incident:related_incident_id(id, incident_number, title),
      problem:related_problem_id(id, problem_number, title),
      requester:requested_by(full_name),
      assignee:assigned_to(full_name),
      workflow:workflow_instance_id(id, instance_number, status)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Cambios ligados a un incidente (tracking en el detalle del caso). */
export async function getChangesForIncident(supabase: SupabaseClient, incidentId: string) {
  const { data, error } = await supabase
    .from("change_request")
    .select("id, change_number, title, status, risk_level")
    .eq("related_incident_id", incidentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; change_number: string; title: string; status: string; risk_level: string }[];
}

export async function getChangesForProblem(supabase: SupabaseClient, problemId: string) {
  const { data, error } = await supabase
    .from("change_request")
    .select("id, change_number, title, status, risk_level")
    .eq("related_problem_id", problemId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; change_number: string; title: string; status: string; risk_level: string }[];
}

export type ChangeFormOptions = {
  services: { id: string; name: string }[];
  apps: { id: string; name: string }[];
};

export async function getChangeFormOptions(supabase: SupabaseClient): Promise<ChangeFormOptions> {
  const [services, apps] = await Promise.all([
    supabase.from("service").select("id, name").eq("status", "active").order("name"),
    supabase.from("configuration_item").select("id, name").eq("ci_type", "application").eq("status", "active").order("name"),
  ]);
  return {
    services: (services.data ?? []) as ChangeFormOptions["services"],
    apps: (apps.data ?? []) as ChangeFormOptions["apps"],
  };
}
