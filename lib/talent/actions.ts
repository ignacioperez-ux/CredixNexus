"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";

/** Asigna un responsable al caso y lo pasa a "assigned". `viaSuggestion` solo cambia la
 *  nota de auditoria (asignacion manual vs. tomada de la sugerencia de IA). */
export async function assignIncidentMember(incidentId: string, memberId: string, viaSuggestion = false): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!memberId) return { ok: false, error: ErrorCode.REQUIRED };
  const { data: member } = await ctx.supabase.from("team_member").select("name").eq("id", memberId).maybeSingle();
  const { error } = await ctx.supabase.from("incident").update({ assigned_member_id: memberId, status: "assigned" }).eq("id", incidentId);
  if (error) return { ok: false, error: error.message };
  await ctx.supabase.from("incident_comment").insert({
    tenant_id: ctx.tenantId,
    incident_id: incidentId,
    author_user_id: ctx.accountId,
    body: viaSuggestion
      ? `Asignado a ${member?.name ?? "recurso"} (tomando la sugerencia del sistema).`
      : `Asignado a ${member?.name ?? "recurso"}.`,
    visibility: "internal",
    is_system_generated: true,
  });
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true };
}
