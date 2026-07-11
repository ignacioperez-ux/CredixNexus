"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode, minLength } from "@/lib/validation";
import { validateDefinition } from "@/lib/workflows/validation";
import type { NodeType } from "@/lib/workflows/graph";

export type WfResult = { ok: boolean; error?: string; id?: string; issues?: { code: string; node?: string }[] };

const NODE_TYPES = ["start", "task", "approval", "automated", "end"];
const orNull = (v?: string | null) => (v && v.trim().length > 0 ? v.trim() : null);

async function guard(perm: string) {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, perm))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

// ---- Runtime (workflow.run) ------------------------------------------------
export async function startWorkflow(definitionId: string, entityType: string, entityId: string | null, title: string): Promise<WfResult> {
  const { ctx, err } = await guard("workflow.run");
  if (!ctx) return { ok: false, error: err! };
  if (minLength(title, 3)) return { ok: false, error: ErrorCode.REQUIRED };
  const { data, error } = await ctx.supabase.rpc("start_workflow", {
    p_definition_id: definitionId,
    p_entity_type: entityType || "generic",
    p_entity_id: entityId,
    p_title: title.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/workflows");
  if (entityId && entityType === "incident") revalidatePath(`/incidents/${entityId}`);
  return { ok: true, id: data as string };
}

export async function advanceStep(stepId: string, outcome: string, note?: string): Promise<WfResult> {
  const { ctx, err } = await guard("workflow.run");
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.rpc("advance_workflow_step", { p_step_id: stepId, p_outcome: outcome, p_note: orNull(note) });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/workflows");
  return { ok: true };
}

export async function cancelInstance(id: string): Promise<WfResult> {
  const { ctx, err } = await guard("workflow.run");
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("workflow_instance").update({ status: "cancelled", completed_at: new Date().toISOString(), updated_by: ctx.accountId }).eq("id", id).eq("status", "running");
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/workflows/${id}`);
  revalidatePath("/workflows");
  return { ok: true, id };
}

// ---- Diseno de definiciones (workflow.manage) ------------------------------
export async function createDefinition(input: { code: string; name: string; description?: string; entityType: string }): Promise<WfResult> {
  const { ctx, err } = await guard("workflow.manage");
  if (!ctx) return { ok: false, error: err! };
  if (minLength(input.code, 2) || minLength(input.name, 3)) return { ok: false, error: ErrorCode.REQUIRED };
  const { data, error } = await ctx.supabase.from("workflow_definition").insert({
    tenant_id: ctx.tenantId, code: input.code.trim(), name: input.name.trim(),
    description: orNull(input.description), entity_type: input.entityType || "generic", status: "draft", created_by: ctx.accountId,
  }).select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath("/workflows");
  return { ok: true, id: data.id as string };
}

export async function publishDefinition(id: string): Promise<WfResult> {
  const { ctx, err } = await guard("workflow.manage");
  if (!ctx) return { ok: false, error: err! };
  const [nodes, edges] = await Promise.all([
    ctx.supabase.from("workflow_node").select("id, code, node_type").eq("definition_id", id),
    ctx.supabase.from("workflow_edge").select("from_node_id, to_node_id, guard").eq("definition_id", id),
  ]);
  const issues = validateDefinition(
    (nodes.data ?? []) as { id: string; code: string; node_type: NodeType }[],
    (edges.data ?? []) as { from_node_id: string; to_node_id: string; guard: string | null }[],
  );
  if (issues.length > 0) return { ok: false, error: ErrorCode.FORMAT, issues };
  const { error } = await ctx.supabase.from("workflow_definition").update({ status: "active", updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/workflows/definitions/${id}`);
  revalidatePath("/workflows");
  return { ok: true, id };
}

export async function setDefinitionStatus(id: string, status: "draft" | "inactive"): Promise<WfResult> {
  const { ctx, err } = await guard("workflow.manage");
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("workflow_definition").update({ status, updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/workflows/definitions/${id}`);
  revalidatePath("/workflows");
  return { ok: true, id };
}

async function assertDraft(supabase: NonNullable<Awaited<ReturnType<typeof getContext>>>["supabase"], definitionId: string): Promise<boolean> {
  const { data } = await supabase.from("workflow_definition").select("status").eq("id", definitionId).maybeSingle();
  return data?.status === "draft";
}

export async function addNode(definitionId: string, input: { code: string; name: string; nodeType: string; assigneeRole?: string; assigneeTeam?: string; slaMinutes?: number | null; sortOrder?: number }): Promise<WfResult> {
  const { ctx, err } = await guard("workflow.manage");
  if (!ctx) return { ok: false, error: err! };
  if (!(await assertDraft(ctx.supabase, definitionId))) return { ok: false, error: "not_draft" };
  if (minLength(input.code, 2) || minLength(input.name, 2) || !NODE_TYPES.includes(input.nodeType)) return { ok: false, error: ErrorCode.FORMAT };
  const { error } = await ctx.supabase.from("workflow_node").insert({
    tenant_id: ctx.tenantId, definition_id: definitionId, code: input.code.trim(), name: input.name.trim(),
    node_type: input.nodeType, assignee_role: orNull(input.assigneeRole), assignee_team: orNull(input.assigneeTeam),
    sla_minutes: input.slaMinutes && input.slaMinutes > 0 ? input.slaMinutes : null, sort_order: input.sortOrder ?? 0, created_by: ctx.accountId,
  });
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath(`/workflows/definitions/${definitionId}`);
  return { ok: true };
}

export async function deleteNode(definitionId: string, nodeId: string): Promise<WfResult> {
  const { ctx, err } = await guard("workflow.manage");
  if (!ctx) return { ok: false, error: err! };
  if (!(await assertDraft(ctx.supabase, definitionId))) return { ok: false, error: "not_draft" };
  const { error } = await ctx.supabase.from("workflow_node").delete().eq("id", nodeId).eq("definition_id", definitionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/workflows/definitions/${definitionId}`);
  return { ok: true };
}

export async function addEdge(definitionId: string, input: { fromNodeId: string; toNodeId: string; guard?: string; label?: string; sortOrder?: number }): Promise<WfResult> {
  const { ctx, err } = await guard("workflow.manage");
  if (!ctx) return { ok: false, error: err! };
  if (!(await assertDraft(ctx.supabase, definitionId))) return { ok: false, error: "not_draft" };
  if (!input.fromNodeId || !input.toNodeId) return { ok: false, error: ErrorCode.REQUIRED };
  if (input.fromNodeId === input.toNodeId) return { ok: false, error: ErrorCode.FORMAT };
  const { error } = await ctx.supabase.from("workflow_edge").insert({
    tenant_id: ctx.tenantId, definition_id: definitionId, from_node_id: input.fromNodeId, to_node_id: input.toNodeId,
    guard: orNull(input.guard), label: orNull(input.label), sort_order: input.sortOrder ?? 0, created_by: ctx.accountId,
  });
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath(`/workflows/definitions/${definitionId}`);
  return { ok: true };
}

export async function deleteEdge(definitionId: string, edgeId: string): Promise<WfResult> {
  const { ctx, err } = await guard("workflow.manage");
  if (!ctx) return { ok: false, error: err! };
  if (!(await assertDraft(ctx.supabase, definitionId))) return { ok: false, error: "not_draft" };
  const { error } = await ctx.supabase.from("workflow_edge").delete().eq("id", edgeId).eq("definition_id", definitionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/workflows/definitions/${definitionId}`);
  return { ok: true };
}
