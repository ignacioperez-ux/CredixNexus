import type { SupabaseClient } from "@supabase/supabase-js";

// Major Incident Command. RLS aisla por tenant; consultas acotadas al contexto.

export type MiRow = {
  id: string;
  mi_number: string;
  title: string;
  severity: string;
  status: string;
  declared_at: string;
  next_update_due_at: string | null;
  incident: { id: string; incident_number: string; status: string } | null;
  commander: { full_name: string } | null;
};

export type CommanderRef = { id: string; full_name: string } | null;

/** El caso "paso a Evolucion" cuando el incidente origen quedo en estado in_evolution. */
export function isCaseInEvolution(incidentStatus: string | null | undefined): boolean {
  return incidentStatus === "in_evolution";
}

/** Resuelve el titular de un rol dentro del tenant (RLS acota user_account por tenant).
 *  Determinista: primer usuario activo por nombre. Sin hardcode de nombres (§11). */
async function roleHolder(supabase: SupabaseClient, roleCode: string): Promise<CommanderRef> {
  const { data, error } = await supabase
    .from("user_account")
    .select("id, full_name, user_role!inner(role:role_id!inner(code))")
    .eq("status", "active")
    .eq("user_role.role.code", roleCode)
    .order("full_name")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { id: (data as { id: string }).id, full_name: (data as { full_name: string }).full_name } : null;
}

/** Comandante DERIVADO por rol: Gerencia de Operaciones (support_lead) por defecto;
 *  Lider de Evolucion (product_owner) si el caso paso a Evolucion. Fuente unica para
 *  lista y detalle, para que el comandante mostrado sea siempre consistente. */
export async function getMiCommanders(supabase: SupabaseClient): Promise<{ ops: CommanderRef; evo: CommanderRef }> {
  const [ops, evo] = await Promise.all([roleHolder(supabase, "support_lead"), roleHolder(supabase, "product_owner")]);
  return { ops, evo };
}

export function pickCommander(c: { ops: CommanderRef; evo: CommanderRef }, inEvolution: boolean): { ref: CommanderRef; scope: "ops" | "evo" } {
  return inEvolution && c.evo ? { ref: c.evo, scope: "evo" } : { ref: c.ops, scope: "ops" };
}

export type MiStats = { active: number; sev1: number; commsOverdue: number };
export type MiData = { incidents: MiRow[]; stats: MiStats };

const ACTIVE = ["declared", "investigating", "identified", "mitigating", "monitoring"];

export async function listMajorIncidents(supabase: SupabaseClient): Promise<MiData> {
  const { data, error } = await supabase
    .from("major_incident")
    .select("id, mi_number, title, severity, status, declared_at, next_update_due_at, incident:incident_id(id, incident_number, status)")
    .order("declared_at", { ascending: false });
  if (error) throw new Error(error.message);
  const incidents = (data ?? []) as unknown as MiRow[];
  // Comandante derivado por rol (no por el commander_user_id almacenado): consistente con el detalle.
  const commanders = await getMiCommanders(supabase);
  for (const m of incidents) {
    const { ref } = pickCommander(commanders, isCaseInEvolution(m.incident?.status));
    m.commander = ref ? { full_name: ref.full_name } : null;
  }
  const now = new Date().toISOString();
  return {
    incidents,
    stats: {
      active: incidents.filter((m) => ACTIVE.includes(m.status)).length,
      sev1: incidents.filter((m) => m.severity === "sev1" && ACTIVE.includes(m.status)).length,
      commsOverdue: incidents.filter((m) => ACTIVE.includes(m.status) && m.next_update_due_at && m.next_update_due_at < now).length,
    },
  };
}

export async function getMajorIncident(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("major_incident")
    .select(`*,
      incident:incident_id(id, incident_number, title, priority, status),
      commander:commander_user_id(full_name),
      comms_lead:comms_lead_user_id(full_name)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type MiUpdateRow = { id: string; update_type: string; body: string; posted_at: string; poster: { full_name: string } | null };

export async function getMajorIncidentUpdates(supabase: SupabaseClient, miId: string): Promise<MiUpdateRow[]> {
  const { data, error } = await supabase
    .from("major_incident_update")
    .select("id, update_type, body, posted_at, poster:posted_by(full_name)")
    .eq("mi_id", miId)
    .order("posted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MiUpdateRow[];
}

/** Incidente mayor asociado a un incidente (para el detalle del caso). */
export async function getMajorIncidentForIncident(supabase: SupabaseClient, incidentId: string) {
  const { data, error } = await supabase
    .from("major_incident")
    .select("id, mi_number, severity, status")
    .eq("incident_id", incidentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; mi_number: string; severity: string; status: string } | null;
}

/** Usuarios candidatos a comandante / lider de comunicaciones. */
export async function getCommandOptions(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("user_account").select("id, full_name").eq("status", "active").order("full_name").limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; full_name: string }[];
}
