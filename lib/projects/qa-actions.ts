"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { validateValidationRun, canQaTransition, canAuthorizeProduction, type ValidationRunInput } from "@/lib/projects/qa-validation";

export type QaResult = { ok: boolean; error?: string; id?: string };

const orNull = (v?: string | null) => (v && v.trim().length > 0 ? v.trim() : null);

async function guard(perm: string) {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, perm))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

/** Registra una corrida de la bateria de pruebas (evidencia). */
export async function recordValidation(projectId: string, input: ValidationRunInput & { evidenceUrl?: string; notes?: string }): Promise<QaResult> {
  const { ctx, err } = await guard("project.validate");
  if (!ctx) return { ok: false, error: err! };
  const v = validateValidationRun(input);
  if (v) return { ok: false, error: v };
  const { data, error } = await ctx.supabase.from("project_validation").insert({
    tenant_id: ctx.tenantId, project_id: projectId, name: input.name.trim(),
    test_type: input.testType, environment: input.environment, result: input.result,
    evidence_url: orNull(input.evidenceUrl), notes: orNull(input.notes),
    run_by: ctx.accountId, created_by: ctx.accountId,
  }).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: data.id as string };
}

/** Cambia el estado de calidad del proyecto (maquina de estados). */
export async function setQaStatus(projectId: string, next: string): Promise<QaResult> {
  const { ctx, err } = await guard("project.validate");
  if (!ctx) return { ok: false, error: err! };
  const { data: cur } = await ctx.supabase.from("project").select("qa_status").eq("id", projectId).maybeSingle();
  if (!cur) return { ok: false, error: "not_found" };
  if (!canQaTransition(cur.qa_status as string, next)) return { ok: false, error: ErrorCode.FORMAT };
  const { error } = await ctx.supabase.from("project").update({ qa_status: next, updated_by: ctx.accountId }).eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: projectId };
}

/** Autoriza el pase a produccion. Control duro: solo si la calidad esta APROBADA
 *  y con permiso project.deploy (responsable de Evolucion). */
export async function authorizeProduction(projectId: string, notes?: string): Promise<QaResult> {
  const { ctx, err } = await guard("project.deploy");
  if (!ctx) return { ok: false, error: err! };
  const { data: cur } = await ctx.supabase.from("project").select("qa_status, prod_authorized_at").eq("id", projectId).maybeSingle();
  if (!cur) return { ok: false, error: "not_found" };
  if (cur.prod_authorized_at) return { ok: false, error: "already_authorized" };
  if (!canAuthorizeProduction(cur.qa_status as string)) return { ok: false, error: "qa_not_passed" };

  const { error } = await ctx.supabase.from("project").update({
    prod_authorized_by: ctx.accountId,
    prod_authorized_at: new Date().toISOString(),
    validation_notes: orNull(notes),
    updated_by: ctx.accountId,
  }).eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: projectId };
}
