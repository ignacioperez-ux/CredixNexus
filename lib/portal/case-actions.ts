"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";

export type ActionResult = { ok: boolean; error?: string };

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
