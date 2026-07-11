"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";

export type CsatResult = { ok: boolean; error?: string };

/** Registra la satisfaccion del usuario (1-5) de un caso resuelto. Audit-grade. */
export async function submitCsat(incidentId: string, score: number, comment?: string): Promise<CsatResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await hasPermission(ctx.supabase, "survey.submit"))) return { ok: false, error: ErrorCode.PERMISSION };
  if (!Number.isInteger(score) || score < 1 || score > 5) return { ok: false, error: ErrorCode.FORMAT };

  // Asegura que exista la encuesta (por si el caso se resolvio antes del modulo).
  await ctx.supabase.from("case_survey").upsert({ tenant_id: ctx.tenantId, incident_id: incidentId, status: "pending" }, { onConflict: "incident_id", ignoreDuplicates: true });

  const { error } = await ctx.supabase
    .from("case_survey")
    .update({ status: "submitted", score, comment: comment && comment.trim().length > 0 ? comment.trim() : null, submitted_at: new Date().toISOString(), submitted_by: ctx.accountId, updated_by: ctx.accountId })
    .eq("incident_id", incidentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true };
}
