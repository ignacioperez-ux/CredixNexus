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

// ---- Evidencia del incidente mayor (bucket privado, URLs firmadas). Espeja casework. ----
const MI_EVIDENCE_BUCKET = "case-attachments";
const MI_EVIDENCE_TTL = 3600; // 1 hora

export type MiEvidence = {
  id: string; file_name: string; mime_type: string | null; size_bytes: number;
  created_at: string; uploaded_by: string | null; url: string | null;
};

export async function getMajorIncidentEvidence(supabase: SupabaseClient, miId: string): Promise<MiEvidence[]> {
  const { data, error } = await supabase
    .from("major_incident_evidence")
    .select("id, file_name, mime_type, size_bytes, storage_path, created_at, uploader:uploaded_by(full_name)")
    .eq("mi_id", miId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const paths = rows.map((r) => r.storage_path as string);
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(MI_EVIDENCE_BUCKET).createSignedUrls(paths, MI_EVIDENCE_TTL);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return rows.map((r) => {
    const up = r.uploader as { full_name: string } | null;
    return {
      id: r.id as string, file_name: r.file_name as string, mime_type: (r.mime_type as string | null) ?? null,
      size_bytes: Number(r.size_bytes), created_at: r.created_at as string,
      uploaded_by: up?.full_name ?? null, url: urls.get(r.storage_path as string) ?? null,
    };
  });
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
