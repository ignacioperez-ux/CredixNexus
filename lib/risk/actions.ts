"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";

export type RiskResult = { ok: boolean; error?: string; id?: string };

const PERM = "risk.manage";

/** Convierte/vincula un caso a un evento de riesgo operativo. La pérdida estimada
 *  se toma del monto o del impacto financiero del caso. Auditado. */
export async function createRiskEvent(incidentId: string): Promise<RiskResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ok: false, error: ErrorCode.PERMISSION };

  const { data: existing } = await ctx.supabase.from("risk_event").select("id").eq("incident_id", incidentId).limit(1);
  if (existing && existing.length > 0) return { ok: true, id: existing[0].id as string };

  const { data: inc } = await ctx.supabase
    .from("incident")
    .select("title, category, amount, financial_impact_estimate, currency")
    .eq("id", incidentId)
    .maybeSingle();
  if (!inc) return { ok: false, error: "not_found" };

  const estimated = Number(inc.amount ?? inc.financial_impact_estimate ?? 0);
  const { data, error } = await ctx.supabase
    .from("risk_event")
    .insert({
      tenant_id: ctx.tenantId,
      incident_id: incidentId,
      risk_category: (inc.category as string)?.toLowerCase() ?? "operational",
      description: inc.title,
      estimated_loss: estimated,
      currency: inc.currency ?? "CRC",
      owner_user_id: ctx.accountId,
      status: "open",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await ctx.supabase.from("incident_comment").insert({
    tenant_id: ctx.tenantId,
    incident_id: incidentId,
    author_user_id: ctx.accountId,
    body: "Registrado como evento de riesgo operativo.",
    visibility: "internal",
    is_system_generated: true,
  });

  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/risk");
  return { ok: true, id: data.id as string };
}

export async function updateRiskStatus(id: string, status: string): Promise<RiskResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ok: false, error: ErrorCode.PERMISSION };
  const { error } = await ctx.supabase.from("risk_event").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/risk");
  return { ok: true, id };
}
