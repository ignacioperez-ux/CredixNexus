"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { validateClassification, validateDiscard, routesToEvolution } from "@/lib/triage/validation";

export type TriageResult = { ok: boolean; error?: string };

async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, "triage.manage"))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

async function systemComment(ctx: NonNullable<Awaited<ReturnType<typeof getContext>>>, incidentId: string, body: string, visibility: "internal" | "partner" = "internal") {
  await ctx.supabase.from("incident_comment").insert({
    tenant_id: ctx.tenantId, incident_id: incidentId, author_user_id: ctx.accountId,
    body, visibility, is_system_generated: true,
  });
}

/** Admite el caso y lo clasifica. Incidencia -> Operaciones (o resuelto directo si
 *  hay KB que aplica). Mejora/Proyecto -> Evolucion (queda de ancla, in_evolution). */
export async function acceptCase(incidentId: string, classifiedAs: string, kbArticleId?: string): Promise<TriageResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateClassification(classifiedAs);
  if (v) return { ok: false, error: v };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    intake_status: "accepted",
    classified_as: classifiedAs,
    triaged_by: ctx.accountId,
    triaged_at: now,
    updated_by: ctx.accountId,
  };

  if (routesToEvolution(classifiedAs)) {
    // Enrutar a Evolucion: la mesa mantiene el tracking (in_evolution, no se cierra).
    const { data: evo } = await ctx.supabase.from("delivery_area").select("id").eq("code", "evolution").maybeSingle();
    patch.status = "in_evolution";
    patch.transformation_candidate = true;
    patch.transformation_decision = "to_evolution";
    if (evo?.id) patch.delivery_area_id = evo.id;
    const { error } = await ctx.supabase.from("incident").update(patch).eq("id", incidentId);
    if (error) return { ok: false, error: error.message };
    await systemComment(ctx, incidentId, `Caso admitido y clasificado como ${classifiedAs === "project" ? "proyecto" : "mejora"}. Enviado a Evolucion; la mesa mantiene el tracking.`, "partner");
  } else if (kbArticleId) {
    // Incidencia ya conocida: se resuelve directo con la base de conocimiento.
    patch.status = "resolved";
    patch.resolved_at = now;
    patch.kb_matched_article_id = kbArticleId;
    patch.resolution_code = "kb_match";
    const { error } = await ctx.supabase.from("incident").update(patch).eq("id", incidentId);
    if (error) return { ok: false, error: error.message };
    await systemComment(ctx, incidentId, "Caso resuelto directamente con un articulo de la base de conocimiento (problema ya conocido).");
  } else {
    // Incidencia nueva -> queda en Operaciones lista para asignar.
    patch.status = "triaged";
    const { error } = await ctx.supabase.from("incident").update(patch).eq("id", incidentId);
    if (error) return { ok: false, error: error.message };
    await systemComment(ctx, incidentId, "Caso admitido como incidencia. Gestion por Operaciones.");
  }

  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/triage");
  revalidatePath("/incidents");
  return { ok: true };
}

/** Descarta el caso: SIEMPRE queda registrado (pasa a resuelto con el motivo). */
export async function discardCase(incidentId: string, reason: string): Promise<TriageResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateDiscard(reason);
  if (v) return { ok: false, error: v };

  const { error } = await ctx.supabase.from("incident").update({
    intake_status: "discarded",
    discard_reason: reason.trim(),
    status: "resolved",
    resolved_at: new Date().toISOString(),
    resolution_code: "discarded",
    resolution_summary: reason.trim(),
    triaged_by: ctx.accountId,
    triaged_at: new Date().toISOString(),
    updated_by: ctx.accountId,
  }).eq("id", incidentId);
  if (error) return { ok: false, error: error.message };

  await systemComment(ctx, incidentId, `Caso descartado en admision (no corresponde a ningun tipo de caso). Motivo: ${reason.trim()}`);
  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/triage");
  revalidatePath("/incidents");
  return { ok: true };
}
