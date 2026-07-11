import type { SupabaseClient } from "@supabase/supabase-js";

// Problem Management (ITIL 4). RLS filtra por tenant; mantenemos consultas acotadas.

export type ProblemRow = {
  id: string;
  problem_number: string;
  title: string;
  status: string;
  priority: string;
  category: string | null;
  known_error: boolean;
  opened_at: string;
  resolved_at: string | null;
  owner: { full_name: string } | null;
  linked_count: number;
};

export type ProblemStats = { open: number; knownErrors: number; resolved: number; linkedIncidents: number };
export type ProblemData = { problems: ProblemRow[]; stats: ProblemStats };

const OPEN_STATES = ["new", "investigating", "known_error"];

export async function listProblems(supabase: SupabaseClient): Promise<ProblemData> {
  const { data, error } = await supabase
    .from("problem")
    .select("id, problem_number, title, status, priority, category, known_error, opened_at, resolved_at, owner:owner_user_id(full_name), links:problem_incident(count)")
    .order("opened_at", { ascending: false });
  if (error) throw new Error(error.message);

  const problems: ProblemRow[] = (data ?? []).map((p) => {
    const row = p as Record<string, unknown>;
    const links = row.links as { count: number }[] | null;
    delete row.links;
    return { ...(row as unknown as Omit<ProblemRow, "linked_count">), linked_count: links?.[0]?.count ?? 0 };
  });

  return {
    problems,
    stats: {
      open: problems.filter((p) => OPEN_STATES.includes(p.status)).length,
      knownErrors: problems.filter((p) => p.known_error).length,
      resolved: problems.filter((p) => p.status === "resolved" || p.status === "closed").length,
      linkedIncidents: problems.reduce((s, p) => s + p.linked_count, 0),
    },
  };
}

export async function getProblem(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("problem")
    .select(`*,
      owner:owner_user_id(full_name),
      service:affected_service_id(name),
      ci:affected_ci_id(name, ci_type)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type LinkedIncident = {
  link_id: string;
  note: string | null;
  incident: { id: string; incident_number: string; title: string; status: string; priority: string } | null;
};

export async function getLinkedIncidents(supabase: SupabaseClient, problemId: string): Promise<LinkedIncident[]> {
  const { data, error } = await supabase
    .from("problem_incident")
    .select("link_id:id, note, incident:incident_id(id, incident_number, title, status, priority)")
    .eq("problem_id", problemId)
    .order("linked_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LinkedIncident[];
}

/** Incidentes aun no vinculados a este problema (para el selector de vinculacion). */
export async function getLinkableIncidents(supabase: SupabaseClient, problemId: string) {
  const { data: linked } = await supabase.from("problem_incident").select("incident_id").eq("problem_id", problemId);
  const excluded = (linked ?? []).map((l) => l.incident_id as string);
  let q = supabase
    .from("incident")
    .select("id, incident_number, title, status")
    .order("opened_at", { ascending: false })
    .limit(50);
  if (excluded.length > 0) q = q.not("id", "in", `(${excluded.join(",")})`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; incident_number: string; title: string; status: string }[];
}

export type ProblemFormOptions = {
  services: { id: string; name: string }[];
  apps: { id: string; name: string }[];
  categories: { code: string; name: string }[];
};

/** Opciones de catalogo real para el formulario de problema (cero hardcode, §11). */
export async function getProblemFormOptions(supabase: SupabaseClient): Promise<ProblemFormOptions> {
  const [services, apps, categories] = await Promise.all([
    supabase.from("service").select("id, name").eq("status", "active").order("name"),
    supabase.from("configuration_item").select("id, name").eq("ci_type", "application").eq("status", "active").order("name"),
    supabase.from("incident_category").select("code, name").eq("status", "active").order("name"),
  ]);
  return {
    services: (services.data ?? []) as ProblemFormOptions["services"],
    apps: (apps.data ?? []) as ProblemFormOptions["apps"],
    categories: (categories.data ?? []) as ProblemFormOptions["categories"],
  };
}

/** Problemas vinculados a un incidente (para mostrar el vinculo en el detalle del caso). */
export async function getProblemsForIncident(supabase: SupabaseClient, incidentId: string) {
  const { data, error } = await supabase
    .from("problem_incident")
    .select("problem:problem_id(id, problem_number, title, status, known_error)")
    .eq("incident_id", incidentId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => r.problem as unknown as { id: string; problem_number: string; title: string; status: string; known_error: boolean } | null)
    .filter((p): p is NonNullable<typeof p> => p !== null);
}
