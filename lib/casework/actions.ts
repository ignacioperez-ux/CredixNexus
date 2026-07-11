"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { validateAttachment, validateTaskTitle, safeFileName, TASK_STATUSES } from "@/lib/casework/validation";
import { ATTACHMENT_BUCKET } from "@/lib/casework/queries";

export type CaseworkResult = { ok: boolean; error?: string; id?: string };

const PERM = "incident.update";

async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

// ---- Adjuntos ----
export async function uploadAttachment(incidentId: string, formData: FormData): Promise<CaseworkResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: ErrorCode.REQUIRED };
  const v = validateAttachment(file.name, file.type, file.size);
  if (v) return { ok: false, error: v };

  // Caso valido en el tenant (RLS acota).
  const { data: inc } = await ctx.supabase.from("incident").select("id").eq("id", incidentId).maybeSingle();
  if (!inc) return { ok: false, error: ErrorCode.INVALID_REFERENCE };

  // Path aislado por tenant (primera carpeta = tenant_id, exigido por la policy de storage).
  const path = `${ctx.tenantId}/${incidentId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: upErr } = await ctx.supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) return { ok: false, error: upErr.message };

  const { data, error } = await ctx.supabase
    .from("case_attachment")
    .insert({ tenant_id: ctx.tenantId, incident_id: incidentId, storage_path: path, file_name: file.name.slice(0, 260), mime_type: file.type || null, size_bytes: file.size, uploaded_by: ctx.accountId })
    .select("id").single();
  if (error) {
    // Compensacion: si falla el registro, remover el objeto subido (no dejar huerfano).
    await ctx.supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
    return { ok: false, error: error.message };
  }
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true, id: data.id as string };
}

export async function deleteAttachment(id: string, incidentId: string): Promise<CaseworkResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { data: att } = await ctx.supabase.from("case_attachment").select("storage_path").eq("id", id).maybeSingle();
  if (!att) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  await ctx.supabase.storage.from(ATTACHMENT_BUCKET).remove([att.storage_path as string]);
  const { error } = await ctx.supabase.from("case_attachment").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true, id };
}

// ---- Checklist de tareas ----
export async function addTask(incidentId: string, title: string, dueDate?: string | null): Promise<CaseworkResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateTaskTitle(title);
  if (v) return { ok: false, error: v };
  const { count } = await ctx.supabase.from("case_task").select("id", { count: "exact", head: true }).eq("incident_id", incidentId);
  const { data, error } = await ctx.supabase
    .from("case_task")
    .insert({ tenant_id: ctx.tenantId, incident_id: incidentId, title: title.trim().slice(0, 300), position: count ?? 0, due_date: dueDate || null, created_by: ctx.accountId })
    .select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true, id: data.id as string };
}

export async function setTaskStatus(id: string, status: string, incidentId: string): Promise<CaseworkResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  if (!(TASK_STATUSES as readonly string[]).includes(status)) return { ok: false, error: ErrorCode.FORMAT };
  const { error } = await ctx.supabase
    .from("case_task")
    .update({ status, done_at: status === "done" ? new Date().toISOString() : null, updated_by: ctx.accountId })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true, id };
}

export async function deleteTask(id: string, incidentId: string): Promise<CaseworkResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("case_task").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true, id };
}
