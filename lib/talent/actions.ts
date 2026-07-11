"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";

export async function assignIncidentMember(incidentId: string, memberId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  const { data: member } = await ctx.supabase.from("team_member").select("name").eq("id", memberId).maybeSingle();
  const { error } = await ctx.supabase.from("incident").update({ assigned_member_id: memberId, status: "assigned" }).eq("id", incidentId);
  if (error) return { ok: false, error: error.message };
  await ctx.supabase.from("incident_comment").insert({
    tenant_id: ctx.tenantId,
    incident_id: incidentId,
    author_user_id: ctx.accountId,
    body: `Asignado a ${member?.name ?? "recurso"} (perfil idoneo sugerido por el sistema).`,
    visibility: "internal",
    is_system_generated: true,
  });
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true };
}
