"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";

export type DecideResult = { ok: boolean; error?: string };

/**
 * Decision del area de negocio (RC) sobre una recomendacion. El RC aprueba/rechaza/
 * difiere y fija la prioridad de negocio. Aprobar la envia a Evolucion manteniendo
 * el tracking en la mesa (client-centric). Queda auditado en el ledger.
 */
export async function decideRecommendation(
  id: string,
  status: "approved" | "rejected" | "deferred",
  priority: number | null,
  reason: string,
): Promise<DecideResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (status === "approved" && (priority == null || priority < 1)) {
    return { ok: false, error: ErrorCode.REQUIRED }; // prioridad obligatoria al aprobar
  }

  const { data: reco, error: e0 } = await ctx.supabase
    .from("project_recommendation")
    .select("incident_id")
    .eq("id", id)
    .maybeSingle();
  if (e0 || !reco) return { ok: false, error: e0?.message ?? "not_found" };

  const { error } = await ctx.supabase
    .from("project_recommendation")
    .update({
      recommendation_status: status,
      business_priority: status === "approved" ? priority : null,
      review_reason: reason?.trim() || null,
      reviewed_by: ctx.accountId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Aprobar: la mejora pasa a Evolucion; la mesa mantiene el tracking.
  if (status === "approved") {
    await ctx.supabase
      .from("incident")
      .update({ status: "in_evolution", transformation_decision: "approved_to_evolution", transformation_candidate: true })
      .eq("id", reco.incident_id);
    await ctx.supabase.from("incident_comment").insert({
      tenant_id: ctx.tenantId,
      incident_id: reco.incident_id,
      author_user_id: ctx.accountId,
      body: `Recomendacion aprobada por el area de negocio (RC) con prioridad ${priority}. Pasa a Evolucion; la mesa mantiene el tracking.`,
      visibility: "partner",
      is_system_generated: true,
    });
  }

  revalidatePath("/rules");
  revalidatePath(`/incidents/${reco.incident_id}`);
  return { ok: true };
}
