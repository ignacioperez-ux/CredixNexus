"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { validateChange, canTransition, canDecideCab } from "@/lib/changes/validation";

export type ChangeResult = { ok: boolean; error?: string; id?: string };

const orNull = (v?: string | null) => (v && v.trim().length > 0 ? v.trim() : null);
const orNullTs = (v?: string | null) => (v && v.length > 0 ? v : null);

export type ChangeInput = {
  title: string;
  description?: string;
  changeType: string;
  riskLevel: string;
  priority?: string | null;
  justification?: string;
  implementationPlan?: string;
  rollbackPlan?: string;
  affectedCiId?: string;
  affectedServiceId?: string;
  relatedIncidentId?: string | null;
  relatedProblemId?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
};

async function guard(perm: string) {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, perm))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

function toRow(input: ChangeInput) {
  return {
    title: input.title.trim(),
    description: orNull(input.description),
    change_type: input.changeType,
    risk_level: input.riskLevel,
    priority: orNull(input.priority) as string | null,
    justification: orNull(input.justification),
    implementation_plan: orNull(input.implementationPlan),
    rollback_plan: orNull(input.rollbackPlan),
    affected_ci_id: orNull(input.affectedCiId),
    affected_service_id: orNull(input.affectedServiceId),
    related_incident_id: orNull(input.relatedIncidentId),
    related_problem_id: orNull(input.relatedProblemId),
    planned_start: orNullTs(input.plannedStart),
    planned_end: orNullTs(input.plannedEnd),
  };
}

export async function createChange(input: ChangeInput): Promise<ChangeResult> {
  const { ctx, err } = await guard("change.manage");
  if (!ctx) return { ok: false, error: err! };
  const v = validateChange(input);
  if (v) return { ok: false, error: v };

  const { data, error } = await ctx.supabase
    .from("change_request")
    .insert({ tenant_id: ctx.tenantId, requested_by: ctx.accountId, created_by: ctx.accountId, status: "draft", ...toRow(input) })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/changes");
  return { ok: true, id: data.id as string };
}

export async function updateChange(id: string, input: ChangeInput): Promise<ChangeResult> {
  const { ctx, err } = await guard("change.manage");
  if (!ctx) return { ok: false, error: err! };
  const v = validateChange(input);
  if (v) return { ok: false, error: v };
  const { error } = await ctx.supabase.from("change_request").update({ ...toRow(input), updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/changes/${id}`);
  revalidatePath("/changes");
  return { ok: true, id };
}

/** Transicion de gestion (no CAB). Valida la maquina de estados y sella tiempos. */
export async function changeStatus(id: string, next: string): Promise<ChangeResult> {
  const { ctx, err } = await guard("change.manage");
  if (!ctx) return { ok: false, error: err! };
  const { data: cur } = await ctx.supabase.from("change_request").select("status, change_number, title").eq("id", id).maybeSingle();
  if (!cur) return { ok: false, error: "not_found" };
  if (!canTransition(cur.status as string, next)) return { ok: false, error: ErrorCode.FORMAT };

  const patch: Record<string, unknown> = { status: next, updated_by: ctx.accountId };
  const now = new Date().toISOString();
  if (next === "implementing") patch.actual_start = now;
  if (next === "review" || next === "closed") patch.actual_end = now;
  const { error } = await ctx.supabase.from("change_request").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  // Campanita v2: al entrar a CAB, avisa a quien preside el CAB (change_manager).
  if (next === "pending_cab") {
    await ctx.supabase.rpc("notify_role", {
      p_role_code: "change_manager", p_type: "change_pending_cab", p_title: "Cambio pendiente de CAB",
      p_body: `${cur.change_number ?? ""} — ${cur.title ?? ""} requiere decision del CAB.`,
      p_entity_type: "change_request", p_entity_id: id, p_link: `/changes/${id}`, p_severity: "warning",
    });
  }
  revalidatePath(`/changes/${id}`);
  revalidatePath("/changes");
  return { ok: true, id };
}

/** Decision CAB: aprobar o rechazar. Requiere change.approve y estado pending_cab. */
export async function cabDecision(id: string, decision: "approved" | "rejected", notes?: string): Promise<ChangeResult> {
  const { ctx, err } = await guard("change.approve");
  if (!ctx) return { ok: false, error: err! };
  const { data: cur } = await ctx.supabase.from("change_request").select("status").eq("id", id).maybeSingle();
  if (!cur) return { ok: false, error: "not_found" };
  if (!canDecideCab(cur.status as string)) return { ok: false, error: ErrorCode.FORMAT };

  const { error } = await ctx.supabase
    .from("change_request")
    .update({
      status: decision, // 'approved' | 'rejected'
      cab_decision: decision,
      cab_decision_at: new Date().toISOString(),
      cab_decision_by: ctx.accountId,
      cab_notes: orNull(notes),
      updated_by: ctx.accountId,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/changes/${id}`);
  revalidatePath("/changes");
  return { ok: true, id };
}
