"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { ATTACHMENT_BUCKET } from "@/lib/casework/queries";
import { validateAttachment, safeFileName } from "@/lib/casework/validation";

export type ActionResult = { ok: boolean; error?: string };

/** Guard de PROPIEDAD del portal: el caso debe ser del usuario (reported_by = cuenta actual).
 *  El bucket/tabla de adjuntos tiene RLS por tenant, asi que el candado de dueno va aqui. */
async function ownCase(ctx: NonNullable<Awaited<ReturnType<typeof getContext>>>, incidentId: string) {
  const { data } = await ctx.supabase
    .from("incident").select("incident_number").eq("id", incidentId).eq("reported_by_user_id", ctx.accountId).maybeSingle();
  return (data as { incident_number: string } | null) ?? null;
}

/** Responder en el hilo del propio caso (owner-check en la RPC; comentario visible para la mesa). */
export async function addMyCaseComment(incidentId: string, body: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!body || body.trim().length === 0) return { ok: false, error: ErrorCode.REQUIRED };
  const { error } = await ctx.supabase.rpc("add_my_case_comment", { p_id: incidentId, p_body: body.trim() });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/portal/cases/${incidentId}`);
  return { ok: true };
}

/** Enviar CSAT (Resolucion/Rapidez/Atencion 1..5 + comentario). Regla P4: al enviar, cierra el caso. */
export async function submitCaseCsat(
  incidentId: string, resolution: number, speed: number, attention: number, comment: string,
): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  for (const v of [resolution, speed, attention]) {
    if (!Number.isInteger(v) || v < 1 || v > 5) return { ok: false, error: ErrorCode.FORMAT };
  }
  const { error } = await ctx.supabase.rpc("submit_case_csat", {
    p_id: incidentId, p_resolution: resolution, p_speed: speed, p_attention: attention, p_comment: comment ?? "",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/portal/cases/${incidentId}`);
  revalidatePath("/portal");
  return { ok: true };
}

/** Subir EVIDENCIA al caso propio (B2). Owner-checked; valida tipo/tamano (<=10MB); path aislado
 *  por tenant (exigido por la policy de storage). Compensa el objeto si falla el registro. */
export async function uploadMyCaseEvidence(incidentId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId || !ctx.accountId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await ownCase(ctx, incidentId))) return { ok: false, error: ErrorCode.PERMISSION };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: ErrorCode.REQUIRED };
  const v = validateAttachment(file.name, file.type, file.size);
  if (v) return { ok: false, error: v };

  const path = `${ctx.tenantId}/${incidentId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: upErr } = await ctx.supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) return { ok: false, error: upErr.message };

  const { error } = await ctx.supabase.from("case_attachment").insert({
    tenant_id: ctx.tenantId, incident_id: incidentId, storage_path: path,
    file_name: file.name.slice(0, 260), mime_type: file.type || null, size_bytes: file.size, uploaded_by: ctx.accountId,
  });
  if (error) { await ctx.supabase.storage.from(ATTACHMENT_BUCKET).remove([path]); return { ok: false, error: error.message }; }
  revalidatePath(`/portal/cases/${incidentId}`);
  return { ok: true };
}

/** Borrar SOLO la evidencia que el propio usuario subio a su caso (uploaded_by = cuenta actual). */
export async function deleteMyCaseEvidence(id: string, incidentId: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId || !ctx.accountId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await ownCase(ctx, incidentId))) return { ok: false, error: ErrorCode.PERMISSION };
  const { data: att } = await ctx.supabase.from("case_attachment").select("storage_path, uploaded_by").eq("id", id).eq("incident_id", incidentId).maybeSingle();
  if (!att || (att.uploaded_by as string | null) !== ctx.accountId) return { ok: false, error: ErrorCode.PERMISSION };
  await ctx.supabase.storage.from(ATTACHMENT_BUCKET).remove([att.storage_path as string]);
  const { error } = await ctx.supabase.from("case_attachment").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/portal/cases/${incidentId}`);
  return { ok: true };
}

/** Escalar a Gerencia (B3): comentario de sistema visible en el hilo + notificacion a Operaciones
 *  (support_lead). Owner-checked, no destructivo (no cambia estado); el comentario queda auditado. */
export async function escalateMyCase(incidentId: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId || !ctx.accountId) return { ok: false, error: ErrorCode.PERMISSION };
  const inc = await ownCase(ctx, incidentId);
  if (!inc) return { ok: false, error: ErrorCode.PERMISSION };

  const { error: cErr } = await ctx.supabase.from("incident_comment").insert({
    tenant_id: ctx.tenantId, incident_id: incidentId, author_user_id: ctx.accountId,
    body: "El cliente solicito escalar el caso a Gerencia.", visibility: "partner", is_system_generated: true,
  });
  if (cErr) return { ok: false, error: cErr.message };
  await ctx.supabase.rpc("notify_role", {
    p_role_code: "support_lead", p_type: "case_escalation_request",
    p_title: "Solicitud de escalamiento", p_body: `El cliente del caso ${inc.incident_number ?? ""} solicito escalar a Gerencia.`,
    p_entity_type: "incident", p_entity_id: incidentId, p_link: `/incidents/${incidentId}`, p_severity: "warning",
  });
  revalidatePath(`/portal/cases/${incidentId}`);
  return { ok: true };
}
