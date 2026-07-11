"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { validateEscalationRule, validateOla, type EscalationRuleInput, type OlaInput } from "@/lib/sla/validation";

export type SlaResult = { ok: boolean; error?: string; id?: string; count?: number };

const PERM = "sla.manage";
const orNull = (v?: string | null) => (v && v.trim().length > 0 ? v.trim() : null);

async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

/** Ejecuta el motor de evaluacion de escalaciones (registra eventos y aplica acciones). */
export async function runEscalations(): Promise<SlaResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { data, error } = await ctx.supabase.rpc("evaluate_escalations");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sla-governance");
  revalidatePath("/incidents");
  return { ok: true, count: (data as number) ?? 0 };
}

export async function acknowledgeEscalation(id: string): Promise<SlaResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase
    .from("escalation_event")
    .update({ acknowledged: true, acknowledged_by: ctx.accountId, acknowledged_at: new Date().toISOString(), updated_by: ctx.accountId })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sla-governance");
  return { ok: true, id };
}

// ---- OLA -------------------------------------------------------------------
export async function upsertOlaPolicy(input: OlaInput & { id?: string }): Promise<SlaResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateOla(input);
  if (v) return { ok: false, error: v };

  const row = {
    tenant_id: ctx.tenantId,
    priority: input.priority,
    assigned_team: orNull(input.assignedTeam),
    response_minutes: input.responseMinutes,
    resolution_minutes: input.resolutionMinutes,
    updated_by: ctx.accountId,
  };

  if (input.id) {
    const { error } = await ctx.supabase.from("ola_policy").update(row).eq("id", input.id);
    if (error) return { ok: false, error: mapErr(error) };
    revalidatePath("/sla-governance");
    return { ok: true, id: input.id };
  }
  const { data, error } = await ctx.supabase.from("ola_policy").insert(row).select("id").single();
  if (error) return { ok: false, error: mapErr(error) };
  revalidatePath("/sla-governance");
  return { ok: true, id: data.id as string };
}

export async function deactivateOlaPolicy(id: string): Promise<SlaResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("ola_policy").update({ status: "inactive", updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sla-governance");
  return { ok: true, id };
}

// ---- Reglas de escalacion --------------------------------------------------
export async function upsertEscalationRule(input: EscalationRuleInput & { id?: string }): Promise<SlaResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateEscalationRule(input);
  if (v) return { ok: false, error: v };

  const row = {
    tenant_id: ctx.tenantId,
    code: input.code.trim(),
    name: input.name.trim(),
    sla_type: input.slaType,
    threshold_pct: input.thresholdPct,
    priority: orNull(input.priority) as string | null,
    action: input.action,
    notify_role: input.action === "notify" ? orNull(input.notifyRole) : null,
    action_target: input.action === "reassign_team" ? orNull(input.actionTarget) : null,
    updated_by: ctx.accountId,
  };

  if (input.id) {
    const { error } = await ctx.supabase.from("escalation_rule").update(row).eq("id", input.id);
    if (error) return { ok: false, error: mapErr(error) };
    revalidatePath("/sla-governance");
    return { ok: true, id: input.id };
  }
  const { data, error } = await ctx.supabase.from("escalation_rule").insert(row).select("id").single();
  if (error) return { ok: false, error: mapErr(error) };
  revalidatePath("/sla-governance");
  return { ok: true, id: data.id as string };
}

export async function deactivateEscalationRule(id: string): Promise<SlaResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("escalation_rule").update({ status: "inactive", updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sla-governance");
  return { ok: true, id };
}

export async function reactivateEscalationRule(id: string): Promise<SlaResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("escalation_rule").update({ status: "active", updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sla-governance");
  return { ok: true, id };
}

function mapErr(error: { code?: string; message: string }): string {
  if (error.code === "23505") return ErrorCode.DUPLICATE;
  return error.message;
}
