"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { validateMajorIncident, validateUpdate, canTransition } from "@/lib/major-incidents/validation";

export type MiResult = { ok: boolean; error?: string; id?: string };

const PERM = "major_incident.manage";
const orNull = (v?: string | null) => (v && v.trim().length > 0 ? v.trim() : null);

async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

/** Declara un incidente critico como incidente mayor y abre el war-room. */
export async function declareMajorIncident(input: { incidentId: string; title: string; severity: string; summary?: string; impactSummary?: string; bridgeUrl?: string }): Promise<MiResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateMajorIncident(input);
  if (v) return { ok: false, error: v };

  const { data: existing } = await ctx.supabase.from("major_incident").select("id").eq("incident_id", input.incidentId).maybeSingle();
  if (existing) return { ok: true, id: existing.id as string };

  const { data, error } = await ctx.supabase
    .from("major_incident")
    .insert({
      tenant_id: ctx.tenantId,
      incident_id: input.incidentId,
      title: input.title.trim(),
      severity: input.severity,
      summary: orNull(input.summary),
      impact_summary: orNull(input.impactSummary),
      bridge_url: orNull(input.bridgeUrl),
      commander_user_id: ctx.accountId,
      status: "declared",
      created_by: ctx.accountId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };

  await ctx.supabase.from("major_incident_update").insert({
    tenant_id: ctx.tenantId, mi_id: data.id, update_type: "status",
    body: "Incidente mayor declarado. War-room abierto.", posted_by: ctx.accountId, created_by: ctx.accountId,
  });
  revalidatePath("/major-incidents");
  revalidatePath(`/incidents/${input.incidentId}`);
  return { ok: true, id: data.id as string };
}

export async function postUpdate(miId: string, updateType: string, body: string, nextUpdateMinutes?: number): Promise<MiResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateUpdate(updateType, body);
  if (v) return { ok: false, error: v };

  const { error } = await ctx.supabase.from("major_incident_update").insert({
    tenant_id: ctx.tenantId, mi_id: miId, update_type: updateType, body: body.trim(), posted_by: ctx.accountId, created_by: ctx.accountId,
  });
  if (error) return { ok: false, error: error.message };

  if (nextUpdateMinutes && nextUpdateMinutes > 0) {
    const due = new Date(Date.now() + nextUpdateMinutes * 60_000).toISOString();
    await ctx.supabase.from("major_incident").update({ next_update_due_at: due, updated_by: ctx.accountId }).eq("id", miId);
  }
  revalidatePath(`/major-incidents/${miId}`);
  return { ok: true, id: miId };
}

export async function changeMiStatus(miId: string, next: string): Promise<MiResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { data: cur } = await ctx.supabase.from("major_incident").select("status").eq("id", miId).maybeSingle();
  if (!cur) return { ok: false, error: "not_found" };
  if (!canTransition(cur.status as string, next)) return { ok: false, error: ErrorCode.FORMAT };

  const patch: Record<string, unknown> = { status: next, updated_by: ctx.accountId };
  const now = new Date().toISOString();
  if (next === "resolved") patch.resolved_at = now;
  if (next === "stood_down") patch.stood_down_at = now;
  const { error } = await ctx.supabase.from("major_incident").update(patch).eq("id", miId);
  if (error) return { ok: false, error: error.message };

  await ctx.supabase.from("major_incident_update").insert({
    tenant_id: ctx.tenantId, mi_id: miId, update_type: "status",
    body: `Estado del incidente mayor: ${next}.`, posted_by: ctx.accountId, created_by: ctx.accountId,
  });
  revalidatePath(`/major-incidents/${miId}`);
  revalidatePath("/major-incidents");
  return { ok: true, id: miId };
}

export async function assignCommand(miId: string, field: "commander" | "comms_lead", userId: string): Promise<MiResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const col = field === "commander" ? "commander_user_id" : "comms_lead_user_id";
  const { error } = await ctx.supabase.from("major_incident").update({ [col]: orNull(userId), updated_by: ctx.accountId }).eq("id", miId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/major-incidents/${miId}`);
  return { ok: true, id: miId };
}
