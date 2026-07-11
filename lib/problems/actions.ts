"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode, required } from "@/lib/validation";
import { validateProblem, PROBLEM_STATUSES, PROBLEM_PRIORITIES } from "@/lib/problems/validation";

export type ProblemResult = { ok: boolean; error?: string; id?: string };

const PERM = "problem.manage";
const STATUSES: readonly string[] = PROBLEM_STATUSES;
const PRIORITIES: readonly string[] = PROBLEM_PRIORITIES;

export type ProblemInput = {
  title: string;
  description?: string;
  priority: string;
  category?: string;
  rootCauseSummary?: string;
  workaround?: string;
  knownError?: boolean;
  affectedCiId?: string;
  affectedServiceId?: string;
};

const orNull = (v?: string) => (v && v.trim().length > 0 ? v.trim() : null);

const validate = (i: ProblemInput): string | null => validateProblem(i);

async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

export async function createProblem(input: ProblemInput): Promise<ProblemResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validate(input);
  if (v) return { ok: false, error: v };

  const { data, error } = await ctx.supabase
    .from("problem")
    .insert({
      tenant_id: ctx.tenantId,
      title: input.title.trim(),
      description: orNull(input.description),
      priority: input.priority,
      category: orNull(input.category),
      root_cause_summary: orNull(input.rootCauseSummary),
      workaround: orNull(input.workaround),
      known_error: !!input.knownError,
      affected_ci_id: orNull(input.affectedCiId),
      affected_service_id: orNull(input.affectedServiceId),
      owner_user_id: ctx.accountId,
      status: input.knownError ? "known_error" : "new",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/problems");
  return { ok: true, id: data.id as string };
}

export async function updateProblem(id: string, input: ProblemInput): Promise<ProblemResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validate(input);
  if (v) return { ok: false, error: v };

  const { error } = await ctx.supabase
    .from("problem")
    .update({
      title: input.title.trim(),
      description: orNull(input.description),
      priority: input.priority,
      category: orNull(input.category),
      root_cause_summary: orNull(input.rootCauseSummary),
      workaround: orNull(input.workaround),
      known_error: !!input.knownError,
      affected_ci_id: orNull(input.affectedCiId),
      affected_service_id: orNull(input.affectedServiceId),
      updated_by: ctx.accountId,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/problems/${id}`);
  revalidatePath("/problems");
  return { ok: true, id };
}

export async function changeProblemStatus(id: string, status: string): Promise<ProblemResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  if (!STATUSES.includes(status)) return { ok: false, error: ErrorCode.FORMAT };
  const patch: Record<string, unknown> = { status, updated_by: ctx.accountId };
  const now = new Date().toISOString();
  if (status === "resolved") patch.resolved_at = now;
  if (status === "closed") patch.closed_at = now;
  const { error } = await ctx.supabase.from("problem").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/problems/${id}`);
  revalidatePath("/problems");
  return { ok: true, id };
}

/** Promueve un incidente a problema y lo vincula (RCA compartida). */
export async function createProblemFromIncident(incidentId: string): Promise<ProblemResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };

  const { data: inc } = await ctx.supabase
    .from("incident")
    .select("title, category, priority, root_cause_summary, affected_ci_id, affected_service_id")
    .eq("id", incidentId)
    .maybeSingle();
  if (!inc) return { ok: false, error: "not_found" };

  const prio = PRIORITIES.includes(inc.priority as string) ? (inc.priority as string) : "medium";
  const { data, error } = await ctx.supabase
    .from("problem")
    .insert({
      tenant_id: ctx.tenantId,
      title: inc.title as string,
      description: `Problema derivado del incidente. Investigacion de causa raiz.`,
      priority: prio,
      category: (inc.category as string | null) ?? null,
      root_cause_summary: (inc.root_cause_summary as string | null) ?? null,
      affected_ci_id: (inc.affected_ci_id as string | null) ?? null,
      affected_service_id: (inc.affected_service_id as string | null) ?? null,
      owner_user_id: ctx.accountId,
      status: "investigating",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const link = await linkIncidentInternal(ctx, data.id as string, incidentId, "Incidente origen del problema");
  if (!link.ok) return link;

  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/problems");
  return { ok: true, id: data.id as string };
}

async function linkIncidentInternal(
  ctx: NonNullable<Awaited<ReturnType<typeof getContext>>>,
  problemId: string,
  incidentId: string,
  note: string | null,
): Promise<ProblemResult> {
  const { error } = await ctx.supabase.from("problem_incident").insert({
    tenant_id: ctx.tenantId,
    problem_id: problemId,
    incident_id: incidentId,
    note,
    linked_by: ctx.accountId,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: ErrorCode.DUPLICATE };
    return { ok: false, error: error.message };
  }
  await ctx.supabase.from("incident_comment").insert({
    tenant_id: ctx.tenantId,
    incident_id: incidentId,
    author_user_id: ctx.accountId,
    body: "Vinculado a un problema para investigacion de causa raiz. La mesa mantiene el tracking.",
    visibility: "internal",
    is_system_generated: true,
  });
  return { ok: true };
}

export async function linkIncidentToProblem(problemId: string, incidentId: string, note?: string): Promise<ProblemResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const e = required(incidentId);
  if (e) return { ok: false, error: e };
  const r = await linkIncidentInternal(ctx, problemId, incidentId, orNull(note));
  if (!r.ok) return r;
  revalidatePath(`/problems/${problemId}`);
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true, id: problemId };
}

export async function unlinkIncidentFromProblem(problemId: string, incidentId: string): Promise<ProblemResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase
    .from("problem_incident")
    .delete()
    .eq("problem_id", problemId)
    .eq("incident_id", incidentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/problems/${problemId}`);
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true, id: problemId };
}
