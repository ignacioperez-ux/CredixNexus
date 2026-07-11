import type { SupabaseClient } from "@supabase/supabase-js";
import type { NodeType } from "./graph";

// Workflow engine. RLS aisla por tenant; consultas acotadas al contexto.

export type DefinitionRow = {
  id: string;
  code: string;
  name: string;
  entity_type: string;
  status: string;
  version_no: number;
  node_count: number;
  instance_count: number;
};

export async function listDefinitions(supabase: SupabaseClient): Promise<DefinitionRow[]> {
  const { data, error } = await supabase
    .from("workflow_definition")
    .select("id, code, name, entity_type, status, version_no, nodes:workflow_node(count), instances:workflow_instance(count)")
    .neq("status", "deleted")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => {
    const row = d as Record<string, unknown>;
    const nodes = row.nodes as { count: number }[] | null;
    const inst = row.instances as { count: number }[] | null;
    delete row.nodes; delete row.instances;
    return { ...(row as unknown as Omit<DefinitionRow, "node_count" | "instance_count">), node_count: nodes?.[0]?.count ?? 0, instance_count: inst?.[0]?.count ?? 0 };
  });
}

export type NodeRow = { id: string; code: string; name: string; node_type: NodeType; assignee_role: string | null; assignee_team: string | null; sla_minutes: number | null; sort_order: number };
export type EdgeRow = { id: string; from_node_id: string; to_node_id: string; guard: string | null; label: string | null; sort_order: number };

export async function getDefinition(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("workflow_definition").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getDefinitionGraph(supabase: SupabaseClient, id: string): Promise<{ nodes: NodeRow[]; edges: EdgeRow[] }> {
  const [nodes, edges] = await Promise.all([
    supabase.from("workflow_node").select("id, code, name, node_type, assignee_role, assignee_team, sla_minutes, sort_order").eq("definition_id", id).order("sort_order"),
    supabase.from("workflow_edge").select("id, from_node_id, to_node_id, guard, label, sort_order").eq("definition_id", id).order("sort_order"),
  ]);
  if (nodes.error) throw new Error(nodes.error.message);
  if (edges.error) throw new Error(edges.error.message);
  return { nodes: (nodes.data ?? []) as NodeRow[], edges: (edges.data ?? []) as EdgeRow[] };
}

export type InstanceRow = {
  id: string;
  instance_number: string;
  title: string;
  status: string;
  entity_type: string;
  entity_id: string | null;
  started_at: string;
  definition: { code: string; name: string } | null;
  active_count: number;
  total_count: number;
};

export async function listInstances(supabase: SupabaseClient): Promise<InstanceRow[]> {
  const { data, error } = await supabase
    .from("workflow_instance")
    .select("id, instance_number, title, status, entity_type, entity_id, started_at, definition:definition_id(code, name), steps:workflow_step(status)")
    .order("started_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => {
    const row = d as Record<string, unknown>;
    const steps = (row.steps as { status: string }[] | null) ?? [];
    delete row.steps;
    return { ...(row as unknown as Omit<InstanceRow, "active_count" | "total_count">), active_count: steps.filter((s) => s.status === "active").length, total_count: steps.length };
  });
}

export async function getInstance(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("workflow_instance")
    .select("*, definition:definition_id(id, code, name, entity_type)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type StepRow = {
  id: string;
  status: string;
  outcome: string | null;
  note: string | null;
  activated_at: string;
  completed_at: string | null;
  node: { code: string; name: string; node_type: NodeType; assignee_role: string | null; assignee_team: string | null; sort_order: number } | null;
};

export async function getInstanceSteps(supabase: SupabaseClient, instanceId: string): Promise<StepRow[]> {
  const { data, error } = await supabase
    .from("workflow_step")
    .select("id, status, outcome, note, activated_at, completed_at, node:node_id(code, name, node_type, assignee_role, assignee_team, sort_order)")
    .eq("instance_id", instanceId)
    .order("activated_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as StepRow[];
  return rows.sort((a, b) => (a.node?.sort_order ?? 0) - (b.node?.sort_order ?? 0));
}

/** Instancias de workflow ligadas a un incidente (tracking en el detalle del caso). */
export async function getWorkflowsForIncident(supabase: SupabaseClient, incidentId: string) {
  const { data, error } = await supabase
    .from("workflow_instance")
    .select("id, instance_number, title, status, definition:definition_id(name)")
    .eq("entity_type", "incident")
    .eq("entity_id", incidentId)
    .order("started_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as { id: string; instance_number: string; title: string; status: string; definition: { name: string } | null }[];
}

/** Instancias de workflow ligadas a un proyecto (pipeline de Evolucion). */
export async function getWorkflowsForProject(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from("workflow_instance")
    .select("id, instance_number, title, status, definition:definition_id(name)")
    .eq("entity_type", "project")
    .eq("entity_id", projectId)
    .order("started_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as { id: string; instance_number: string; title: string; status: string; definition: { name: string } | null }[];
}

/** Definiciones activas para iniciar una instancia (selector). */
export async function getActiveDefinitions(supabase: SupabaseClient, entityType?: string) {
  let q = supabase.from("workflow_definition").select("id, code, name, entity_type").eq("status", "active").order("name");
  if (entityType) q = q.in("entity_type", [entityType, "generic"]);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; code: string; name: string; entity_type: string }[];
}

export async function getWorkflowFormOptions(supabase: SupabaseClient) {
  const [roles, teams] = await Promise.all([
    supabase.from("role").select("code, name").order("code"),
    supabase.from("incident_category").select("default_team").neq("default_team", null),
  ]);
  const teamSet = new Set<string>();
  for (const t of (teams.data ?? []) as { default_team: string | null }[]) if (t.default_team) teamSet.add(t.default_team);
  return { roles: (roles.data ?? []) as { code: string; name: string }[], teams: [...teamSet].sort() };
}
