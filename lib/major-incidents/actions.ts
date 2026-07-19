"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { captureClosureKnowledge } from "@/lib/knowledge/closure";
import { ErrorCode } from "@/lib/validation";
import { validateMajorIncident, validateUpdate, canTransition, isMiEditable, MI_REOPEN_TO } from "@/lib/major-incidents/validation";
import { getMiCommanders } from "@/lib/major-incidents/queries";
import { validateAttachment, safeFileName } from "@/lib/casework/validation";
import { ATTACHMENT_BUCKET } from "@/lib/casework/queries";

export type MiResult = { ok: boolean; error?: string; id?: string };

const PERM = "major_incident.manage";
const orNull = (v?: string | null) => (v && v.trim().length > 0 ? v.trim() : null);

async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

/** Declara un incidente critico como incidente mayor y abre el war-room. */
export async function declareMajorIncident(input: { incidentId: string; title: string; severity: string; summary?: string; impactSummary?: string; bridgeUrl?: string }): Promise<MiResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateMajorIncident(input);
  if (v) return { ok: false, error: v };

  const { data: existing } = await ctx.supabase.from("major_incident").select("id").eq("incident_id", input.incidentId).maybeSingle();
  if (existing) return { ok: true, id: existing.id as string };

  // Comandante fijo por rol (§11): la Gerencia de Operaciones (support_lead) del tenant.
  // Fallback al declarante solo si el rol no esta cubierto, para no dejar el campo nulo.
  const commanders = await getMiCommanders(ctx.supabase);
  const commanderId = commanders.ops?.id ?? ctx.accountId;

  const { data, error } = await ctx.supabase
    .from("major_incident")
    .insert({
      tenant_id: ctx.tenantId,
      incident_id: input.incidentId,
      title: input.title.trim(),
      severity: input.severity,
      summary: orNull(input.summary),
      impact_summary: orNull(input.impactSummary),
      bridge_url: orNull(input.bridgeUrl),
      commander_user_id: commanderId,
      status: "declared",
      created_by: ctx.accountId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };

  await ctx.supabase.from("major_incident_update").insert({
    tenant_id: ctx.tenantId, mi_id: data.id, update_type: "status",
    body: "Incidente mayor declarado. War-room abierto.", posted_by: ctx.accountId, created_by: ctx.accountId,
  });
  // Campanita v2: incidente mayor declarado -> ambas areas (Operaciones y Evolucion).
  const miLink = `/major-incidents/${data.id}`;
  const miBody = `${input.severity.toUpperCase()} — ${input.title.trim()}`;
  for (const role of ["support_lead", "product_owner"]) {
    await ctx.supabase.rpc("notify_role", {
      p_role_code: role, p_type: "major_incident_declared", p_title: "Incidente mayor declarado",
      p_body: miBody, p_entity_type: "major_incident", p_entity_id: data.id, p_link: miLink, p_severity: "critical",
    });
  }
  revalidatePath("/major-incidents");
  revalidatePath(`/incidents/${input.incidentId}`);
  return { ok: true, id: data.id as string };
}

export async function postUpdate(miId: string, updateType: string, body: string, nextUpdateMinutes?: number): Promise<MiResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateUpdate(updateType, body);
  if (v) return { ok: false, error: v };
  // Gobierno de edicion: solo se publica comunicacion con el MI ACTIVO; cerrado = solo lectura.
  const { data: st } = await ctx.supabase.from("major_incident").select("status").eq("id", miId).maybeSingle();
  if (!st) return { ok: false, error: "not_found" };
  if (!isMiEditable(st.status as string)) return { ok: false, error: "MI_CLOSED" };

  const { error } = await ctx.supabase.from("major_incident_update").insert({
    tenant_id: ctx.tenantId, mi_id: miId, update_type: updateType, body: body.trim(), posted_by: ctx.accountId, created_by: ctx.accountId,
  });
  if (error) return { ok: false, error: error.message };

  if (nextUpdateMinutes && nextUpdateMinutes > 0) {
    const due = new Date(Date.now() + nextUpdateMinutes * 60_000).toISOString();
    await ctx.supabase.from("major_incident").update({ next_update_due_at: due, updated_by: ctx.accountId }).eq("id", miId);
  }
  revalidatePath(`/major-incidents/${miId}`);
  return { ok: true, id: miId };
}

export async function changeMiStatus(miId: string, next: string): Promise<MiResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { data: cur } = await ctx.supabase.from("major_incident").select("status, title, summary, impact_summary").eq("id", miId).maybeSingle();
  if (!cur) return { ok: false, error: "not_found" };
  if (!canTransition(cur.status as string, next)) return { ok: false, error: ErrorCode.FORMAT };

  const patch: Record<string, unknown> = { status: next, updated_by: ctx.accountId };
  const now = new Date().toISOString();
  if (next === "resolved") patch.resolved_at = now;
  if (next === "stood_down") patch.stood_down_at = now;
  const { error } = await ctx.supabase.from("major_incident").update(patch).eq("id", miId);
  if (error) return { ok: false, error: error.message };

  // Knowledge al cierre: registra el incidente mayor y su solucion (draft) para reuso.
  if (next === "resolved" || next === "stood_down") {
    await captureClosureKnowledge(ctx.supabase, ctx.tenantId, ctx.accountId, {
      kind: "major_incident", id: miId, title: cur.title as string, category: "major_incident",
      symptom: (cur.impact_summary as string) || (cur.summary as string) || undefined,
    });
  }

  await ctx.supabase.from("major_incident_update").insert({
    tenant_id: ctx.tenantId, mi_id: miId, update_type: "status",
    body: `Estado del incidente mayor: ${next}.`, posted_by: ctx.accountId, created_by: ctx.accountId,
  });
  revalidatePath(`/major-incidents/${miId}`);
  revalidatePath("/major-incidents");
  return { ok: true, id: miId };
}

/** Sube evidencia al incidente mayor (bucket privado, gate por estado ACTIVO). */
export async function uploadMiEvidence(miId: string, formData: FormData): Promise<MiResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: ErrorCode.REQUIRED };
  const v = validateAttachment(file.name, file.type, file.size);
  if (v) return { ok: false, error: v };
  const { data: st } = await ctx.supabase.from("major_incident").select("status").eq("id", miId).maybeSingle();
  if (!st) return { ok: false, error: "not_found" };
  if (!isMiEditable(st.status as string)) return { ok: false, error: "MI_CLOSED" };

  // Path aislado por tenant (primera carpeta = tenant_id, exigido por la policy de storage).
  const path = `${ctx.tenantId}/mi/${miId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: upErr } = await ctx.supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) return { ok: false, error: upErr.message };
  const { data, error } = await ctx.supabase
    .from("major_incident_evidence")
    .insert({ tenant_id: ctx.tenantId, mi_id: miId, storage_path: path, file_name: file.name.slice(0, 260), mime_type: file.type || null, size_bytes: file.size, uploaded_by: ctx.accountId })
    .select("id").single();
  if (error) {
    await ctx.supabase.storage.from(ATTACHMENT_BUCKET).remove([path]); // no dejar huerfano
    return { ok: false, error: error.message };
  }
  revalidatePath(`/major-incidents/${miId}`);
  return { ok: true, id: data.id as string };
}

/** Borra evidencia del incidente mayor (gate por estado ACTIVO). */
export async function deleteMiEvidence(evidenceId: string, miId: string): Promise<MiResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { data: st } = await ctx.supabase.from("major_incident").select("status").eq("id", miId).maybeSingle();
  if (!st) return { ok: false, error: "not_found" };
  if (!isMiEditable(st.status as string)) return { ok: false, error: "MI_CLOSED" };
  const { data: ev } = await ctx.supabase.from("major_incident_evidence").select("storage_path").eq("id", evidenceId).eq("mi_id", miId).maybeSingle();
  if (!ev) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  await ctx.supabase.storage.from(ATTACHMENT_BUCKET).remove([ev.storage_path as string]);
  const { error } = await ctx.supabase.from("major_incident_evidence").delete().eq("id", evidenceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/major-incidents/${miId}`);
  return { ok: true, id: evidenceId };
}

/** Reabre un incidente mayor cerrado: vuelve a estado activo (mitigacion) y se puede editar. */
export async function reopenMajorIncident(miId: string): Promise<MiResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { data: cur } = await ctx.supabase.from("major_incident").select("status").eq("id", miId).maybeSingle();
  if (!cur) return { ok: false, error: "not_found" };
  if (isMiEditable(cur.status as string)) return { ok: false, error: ErrorCode.FORMAT }; // ya esta activo
  const { error } = await ctx.supabase
    .from("major_incident")
    .update({ status: MI_REOPEN_TO, resolved_at: null, stood_down_at: null, updated_by: ctx.accountId })
    .eq("id", miId);
  if (error) return { ok: false, error: error.message };
  await ctx.supabase.from("major_incident_update").insert({
    tenant_id: ctx.tenantId, mi_id: miId, update_type: "status",
    body: "Incidente mayor reabierto: retoma mitigacion activa.", posted_by: ctx.accountId, created_by: ctx.accountId,
  });
  revalidatePath(`/major-incidents/${miId}`);
  revalidatePath("/major-incidents");
  return { ok: true, id: miId };
}

export async function assignCommand(miId: string, field: "commander" | "comms_lead", userId: string): Promise<MiResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  // El comandante es FIJO por rol (§11) y no se asigna manualmente: se deriva del titular de
  // Gerencia de Operaciones / Lider de Evolucion. Solo comms_lead es asignable.
  if (field === "commander") return { ok: false, error: ErrorCode.PERMISSION };
  const col = "comms_lead_user_id";
  const { error } = await ctx.supabase.from("major_incident").update({ [col]: orNull(userId), updated_by: ctx.accountId }).eq("id", miId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/major-incidents/${miId}`);
  return { ok: true, id: miId };
}
