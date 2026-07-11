"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import {
  validateFraudOpen, validateDisputeOpen, validateFraudTransition, validateDisputeTransition, validateRecovery,
  type FraudOpenInput, type DisputeOpenInput,
} from "@/lib/fraud/validation";

export type FraudResult = { ok: boolean; error?: string; id?: string };

async function guard(perm: string) {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, perm))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

// ---- FRAUDE ----------------------------------------------------------------
export async function openFraudCase(incidentId: string, input: FraudOpenInput): Promise<FraudResult> {
  const { ctx, err } = await guard("fraud.manage");
  if (!ctx) return { ok: false, error: err! };
  const v = validateFraudOpen(input);
  if (v) return { ok: false, error: v };

  const { data: inc } = await ctx.supabase.from("incident").select("id").eq("id", incidentId).maybeSingle();
  if (!inc) return { ok: false, error: ErrorCode.INVALID_REFERENCE };

  const { data, error } = await ctx.supabase
    .from("fraud_case")
    .insert({
      tenant_id: ctx.tenantId,
      incident_id: incidentId,
      fraud_type: input.fraudType,
      detection_source: input.detectionSource,
      risk_score: input.riskScore ?? null,
      amount_exposed: input.amountExposed ?? null,
      currency: input.currency || "CRC",
      created_by: ctx.accountId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath("/fraud-disputes");
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true, id: data.id as string };
}

export async function advanceFraudStatus(id: string, toStatus: string): Promise<FraudResult> {
  const { ctx, err } = await guard("fraud.manage");
  if (!ctx) return { ok: false, error: err! };
  const { data: fc } = await ctx.supabase.from("fraud_case").select("status, incident_id").eq("id", id).maybeSingle();
  if (!fc) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const v = validateFraudTransition(fc.status as string, toStatus);
  if (v) return { ok: false, error: v };

  const patch: Record<string, unknown> = { status: toStatus, updated_by: ctx.accountId };
  if (toStatus === "confirmed") patch.confirmed_at = new Date().toISOString();
  if (toStatus === "recovered") patch.recovered_at = new Date().toISOString();
  if (toStatus === "closed") patch.closed_at = new Date().toISOString();
  const { error } = await ctx.supabase.from("fraud_case").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/fraud-disputes");
  revalidatePath(`/fraud-disputes/fraud/${id}`);
  return { ok: true, id };
}

export async function recordFraudRecovery(id: string, amount: number): Promise<FraudResult> {
  const { ctx, err } = await guard("fraud.manage");
  if (!ctx) return { ok: false, error: err! };
  const { data: fc } = await ctx.supabase.from("fraud_case").select("amount_exposed").eq("id", id).maybeSingle();
  if (!fc) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const v = validateRecovery(amount, (fc.amount_exposed as number | null) ?? null);
  if (v) return { ok: false, error: v };
  const { error } = await ctx.supabase.from("fraud_case").update({ amount_recovered: amount, updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/fraud-disputes/fraud/${id}`);
  return { ok: true, id };
}

// ---- DISPUTAS --------------------------------------------------------------
export async function openDispute(incidentId: string, input: DisputeOpenInput): Promise<FraudResult> {
  const { ctx, err } = await guard("dispute.manage");
  if (!ctx) return { ok: false, error: err! };
  const v = validateDisputeOpen(input);
  if (v) return { ok: false, error: v };

  const { data: inc } = await ctx.supabase.from("incident").select("id").eq("id", incidentId).maybeSingle();
  if (!inc) return { ok: false, error: ErrorCode.INVALID_REFERENCE };

  const { data, error } = await ctx.supabase
    .from("dispute_case")
    .insert({
      tenant_id: ctx.tenantId,
      incident_id: incidentId,
      dispute_type: input.disputeType,
      disputed_amount: input.disputedAmount ?? null,
      currency: input.currency || "CRC",
      reason_code: input.reasonCode?.trim() || null,
      due_date: input.dueDate || null,
      created_by: ctx.accountId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath("/fraud-disputes");
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true, id: data.id as string };
}

export async function advanceDisputeStatus(id: string, toStatus: string): Promise<FraudResult> {
  const { ctx, err } = await guard("dispute.manage");
  if (!ctx) return { ok: false, error: err! };
  const { data: dc } = await ctx.supabase.from("dispute_case").select("status").eq("id", id).maybeSingle();
  if (!dc) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const v = validateDisputeTransition(dc.status as string, toStatus);
  if (v) return { ok: false, error: v };

  const patch: Record<string, unknown> = { status: toStatus, updated_by: ctx.accountId };
  if (toStatus === "won" || toStatus === "lost") patch.resolved_at = new Date().toISOString();
  if (toStatus === "closed") patch.closed_at = new Date().toISOString();
  const { error } = await ctx.supabase.from("dispute_case").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/fraud-disputes");
  revalidatePath(`/fraud-disputes/dispute/${id}`);
  return { ok: true, id };
}

export async function recordDisputeRecovery(id: string, amount: number): Promise<FraudResult> {
  const { ctx, err } = await guard("dispute.manage");
  if (!ctx) return { ok: false, error: err! };
  const { data: dc } = await ctx.supabase.from("dispute_case").select("disputed_amount").eq("id", id).maybeSingle();
  if (!dc) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const v = validateRecovery(amount, (dc.disputed_amount as number | null) ?? null);
  if (v) return { ok: false, error: v };
  const { error } = await ctx.supabase.from("dispute_case").update({ amount_recovered: amount, updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/fraud-disputes/dispute/${id}`);
  return { ok: true, id };
}
