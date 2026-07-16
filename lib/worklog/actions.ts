"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { assertActOnIncident } from "@/lib/auth/incident-authz";

export type WorkResult = { ok: boolean; error?: string };

/** Registra esfuerzo (minutos) en un caso, atribuido a la persona asignada. */
export async function logWork(incidentId: string, minutes: number, note?: string): Promise<WorkResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await hasPermission(ctx.supabase, "worklog.manage"))) return { ok: false, error: ErrorCode.PERMISSION };
  // Regla de oro: registrar esfuerzo solo en casos PROPIOS (o gestor). Backend-authoritative.
  const own = await assertActOnIncident(ctx, incidentId);
  if (own) return { ok: false, error: own };
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 100000) return { ok: false, error: ErrorCode.FORMAT };

  const { data: inc } = await ctx.supabase.from("incident").select("assigned_member_id").eq("id", incidentId).maybeSingle();
  const { error } = await ctx.supabase.from("case_work_log").insert({
    tenant_id: ctx.tenantId, incident_id: incidentId,
    member_id: (inc?.assigned_member_id as string | null) ?? null,
    minutes, note: note && note.trim().length > 0 ? note.trim() : null, logged_by: ctx.accountId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true };
}
