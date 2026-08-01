"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { createIncident } from "@/lib/incidents/actions";
import { rankSimilar, SETTLED_STATUSES, type SimilarDraft, type CandidateRow } from "@/lib/incidents/similar";

// Deteccion y AGRUPACION de duplicados en el registro (P4). A diferencia de checkMySimilarCases
// (solo casos del propio usuario), aqui detectamos casos ABIERTOS de CUALQUIER persona del tenant
// que ya agrupan >=2 reportes ("8 personas reportaron lo mismo hoy"), para que el usuario se sume a
// un caso HIJO vinculado en vez de abrir un duplicado nuevo. Solo se expone un RESUMEN seguro del
// agrupador (titulo, conteo, causa/accion/ETA), nunca la fila cruda del caso ajeno.

const AGG_MIN_REPORTS = 2;     // agrupador = >=2 reportes (1 padre + >=1 hijo vinculado activo)
const WINDOW_72H = 72 * 3600 * 1000;
const WINDOW_24H = 24 * 3600 * 1000;

export type Aggregator = {
  parentId: string;
  incidentNumber: string;
  title: string;
  reportCount: number;
  cause: string | null;             // causa conocida (root_cause_summary)
  correctiveAction: string | null;  // accion correctiva (resolution_summary si existe)
  etaAt: string | null;             // hora estimada de resolucion (sla_resolution_due_at)
};
export type AggregatorResult = { ok: boolean; error?: string; top?: Aggregator | null; others?: Aggregator[] };

type AggRow = CandidateRow & {
  opened_at: string;
  root_cause_summary: string | null;
  resolution_summary: string | null;
  sla_resolution_due_at: string | null;
};

/** Casos ABIERTOS (72h) que agrupan >=2 reportes y se parecen al borrador. Devuelve el mejor match
 *  (bloque "N personas reportaron lo mismo") + hasta 3 tendencias de las ultimas 24h (pie del form).
 *  Solo lectura (sin evento de ledger). RLS acota por tenant; se retorna solo un resumen seguro. */
export async function getReportAggregators(draft: SimilarDraft): Promise<AggregatorResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };

  const since72 = new Date(Date.now() - WINDOW_72H).toISOString();
  const { data: rows } = await ctx.supabase
    .from("incident")
    .select("id, incident_number, title, description, status, category_id, affected_ci_id, opened_at, root_cause_summary, resolution_summary, sla_resolution_due_at")
    .not("status", "in", `(${SETTLED_STATUSES.join(",")})`)
    .gte("opened_at", since72)
    .order("opened_at", { ascending: false })
    .limit(150);

  const candidates = (rows ?? []) as AggRow[];
  if (candidates.length === 0) return { ok: true, top: null, others: [] };

  // Conteo de reportes = 1 (padre) + hijos vinculados ACTIVOS.
  const ids = candidates.map((c) => c.id);
  const { data: links } = await ctx.supabase
    .from("incident_duplicate_link")
    .select("primary_incident_id")
    .eq("status", "active")
    .in("primary_incident_id", ids);
  const childCount = new Map<string, number>();
  for (const l of (links ?? []) as { primary_incident_id: string }[]) {
    childCount.set(l.primary_incident_id, (childCount.get(l.primary_incident_id) ?? 0) + 1);
  }
  const reportCount = (id: string) => 1 + (childCount.get(id) ?? 0);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const toAgg = (id: string): Aggregator | null => {
    const c = byId.get(id);
    if (!c) return null;
    return { parentId: c.id, incidentNumber: c.incident_number, title: c.title, reportCount: reportCount(c.id), cause: c.root_cause_summary, correctiveAction: c.resolution_summary, etaAt: c.sla_resolution_due_at };
  };

  // Mejor match del borrador con >=2 reportes.
  let top: Aggregator | null = null;
  for (const hit of rankSimilar(draft, candidates as CandidateRow[])) {
    if (reportCount(hit.id) >= AGG_MIN_REPORTS) { top = toAgg(hit.id); break; }
  }

  // Tendencias 24h: agrupadores (>=2 reportes) por conteo desc, excluyendo el top. Hasta 3.
  const since24 = Date.now() - WINDOW_24H;
  const others = candidates
    .filter((c) => reportCount(c.id) >= AGG_MIN_REPORTS && new Date(c.opened_at).getTime() >= since24 && c.id !== top?.parentId)
    .sort((a, b) => reportCount(b.id) - reportCount(a.id))
    .slice(0, 3)
    .map((c) => toAgg(c.id))
    .filter((a): a is Aggregator => a !== null);

  return { ok: true, top, others };
}

export type JoinResult = { ok: boolean; error?: string; id?: string; number?: string; linked?: boolean };

/** El usuario se SUMA a un caso agrupador: crea SU caso hijo y lo enlaza como duplicado del padre
 *  (source='self_report'), en vez de abrir un caso independiente (P4.3). Usa createIncident (que ya
 *  valida permiso incident.create y registra el ledger); luego inserta el enlace (RLS por tenant).
 *  Al resolverse el padre, el trigger de cascada (0134) cierra el hijo y notifica al reportante. */
export async function joinAsChildCase(parentId: string, description?: string): Promise<JoinResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId || !ctx.accountId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!parentId) return { ok: false, error: ErrorCode.FORMAT };

  // El padre debe existir, ser del tenant (RLS) y estar ABIERTO (no se suma uno a un caso cerrado).
  const { data: parent } = await ctx.supabase.from("incident").select("title, status").eq("id", parentId).maybeSingle();
  if (!parent) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  if (SETTLED_STATUSES.includes((parent as { status: string }).status)) return { ok: false, error: ErrorCode.STATE };

  const parentTitle = (parent as { title: string }).title;
  const desc = description && description.trim().length >= 8 ? description.trim() : `Reporto lo mismo: ${parentTitle}`;

  const r = await createIncident({ title: desc.slice(0, 120), description: desc, impact: "medium", urgency: "medium" });
  if (!r.ok || !r.id) return { ok: false, error: r.error };

  const { error } = await ctx.supabase.from("incident_duplicate_link").insert({
    tenant_id: ctx.tenantId, primary_incident_id: parentId, duplicate_incident_id: r.id,
    source: "self_report", created_by: ctx.accountId, status: "active",
  });
  // Si el enlace falla (p.ej. carrera), el caso ya quedo registrado como caso normal: no se pierde.
  revalidatePath("/portal");
  return { ok: true, id: r.id, number: r.number, linked: !error };
}

/** "Volvio a pasar" (P3): el usuario reporta que un caso RESUELTO volvio a ocurrir. Crea un caso
 *  nuevo marcado como REINCIDENCIA del original (createIncident sube un nivel de prioridad y enlaza
 *  recurrence_of_incident_id). Senal muy valiosa para la mesa (efectividad del fix). */
export async function reportRecurrence(originalId: string): Promise<JoinResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId || !ctx.accountId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!originalId) return { ok: false, error: ErrorCode.FORMAT };
  const { data: orig } = await ctx.supabase.from("incident").select("title").eq("id", originalId).maybeSingle();
  if (!orig) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const desc = `Volvió a pasar: ${(orig as { title: string }).title}`;
  const r = await createIncident({ title: desc.slice(0, 120), description: desc, impact: "medium", urgency: "medium", isRecurrence: true, recurrenceOfIncidentId: originalId });
  if (!r.ok || !r.id) return { ok: false, error: r.error };
  revalidatePath("/portal");
  return { ok: true, id: r.id, number: r.number, linked: true };
}
