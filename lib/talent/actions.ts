"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { ErrorCode } from "@/lib/validation";
import { suggestForIncident, type FitSuggestion } from "@/lib/talent/recommender";
import { validateMember, validateSkill, validateExpertise, validateEvaluation, type MemberInput, type SkillInput, type ExpertiseInput, type EvaluationInput } from "@/lib/talent/validation";

export type TalentResult = { ok: boolean; error?: string; id?: string };

const TALENT_PERM = "talent.manage";
async function talentGuard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, TALENT_PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

/** Sugerencia de responsable bajo demanda (opt-in): solo corre cuando el usuario la pide,
 *  no en la carga de la pagina. La asignacion sigue siendo manual. */
export async function suggestAssignees(incidentId: string): Promise<{ ok: boolean; suggestions?: FitSuggestion[]; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  const suggestions = await suggestForIncident(ctx.supabase, incidentId);
  return { ok: true, suggestions };
}

/** Asigna un responsable al caso y lo pasa a "assigned". `viaSuggestion` solo cambia la
 *  nota de auditoria (asignacion manual vs. tomada de la sugerencia de IA). */
export async function assignIncidentMember(incidentId: string, memberId: string, viaSuggestion = false): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!memberId) return { ok: false, error: ErrorCode.REQUIRED };
  // Defense-in-depth: solo quien gestiona la asignacion (Operaciones/triage/talento).
  const access = await getAccessControl();
  const allowed = access.isAdmin || ["incident.assign", "incident.update", "triage.manage", "talent.manage"].some((c) => access.perms.includes(c));
  if (!allowed) return { ok: false, error: ErrorCode.PERMISSION };
  const { data: member } = await ctx.supabase.from("team_member").select("name").eq("id", memberId).maybeSingle();
  const { error } = await ctx.supabase.from("incident").update({ assigned_member_id: memberId, status: "assigned" }).eq("id", incidentId);
  if (error) return { ok: false, error: error.message };
  await ctx.supabase.from("incident_comment").insert({
    tenant_id: ctx.tenantId,
    incident_id: incidentId,
    author_user_id: ctx.accountId,
    body: viaSuggestion
      ? `Asignado a ${member?.name ?? "recurso"} (tomando la sugerencia del sistema).`
      : `Asignado a ${member?.name ?? "recurso"}.`,
    visibility: "internal",
    is_system_generated: true,
  });
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true };
}

// ---- CRUD de profesionales (Talento) — regla §10 completa ---------------------

/** Duplicado de email (§10.4 capa servicio): mismo email (case-insensitive) en el tenant, no borrado. */
async function emailTaken(ctx: NonNullable<Awaited<ReturnType<typeof talentGuard>>["ctx"]>, email: string | undefined, exceptId?: string): Promise<boolean> {
  const e = email?.trim();
  if (!e) return false;
  let q = ctx.supabase.from("team_member").select("id").eq("tenant_id", ctx.tenantId).ilike("email", e).neq("status", "deleted");
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q.limit(1);
  return (data?.length ?? 0) > 0;
}

/** Alta de profesional (interno/externo) asociado a un stream (operaciones/evolucion). */
export async function createMember(input: MemberInput): Promise<TalentResult> {
  const { ctx, err } = await talentGuard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateMember(input);
  if (v) return { ok: false, error: v };
  if (await emailTaken(ctx, input.email)) return { ok: false, error: ErrorCode.DUPLICATE };
  const { data, error } = await ctx.supabase.from("team_member").insert({
    tenant_id: ctx.tenantId,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    is_external: input.isExternal,
    external_type: input.isExternal ? (input.externalType || null) : null,
    delivery_area_id: input.deliveryAreaId,
    discipline: input.discipline || null,
    seniority: input.seniority || null,
    capacity_points: input.capacityPoints,
    created_by: ctx.accountId,
    updated_by: ctx.accountId,
  }).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/talent");
  return { ok: true, id: data.id as string };
}

export async function updateMember(id: string, input: MemberInput): Promise<TalentResult> {
  const { ctx, err } = await talentGuard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateMember(input);
  if (v) return { ok: false, error: v };
  if (await emailTaken(ctx, input.email, id)) return { ok: false, error: ErrorCode.DUPLICATE };
  const { error } = await ctx.supabase.from("team_member").update({
    name: input.name.trim(),
    email: input.email?.trim() || null,
    is_external: input.isExternal,
    external_type: input.isExternal ? (input.externalType || null) : null,
    delivery_area_id: input.deliveryAreaId,
    discipline: input.discipline || null,
    seniority: input.seniority || null,
    capacity_points: input.capacityPoints,
    updated_by: ctx.accountId,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/talent/${id}`);
  revalidatePath("/talent");
  return { ok: true, id };
}

/** Baja/reactivacion logica (soft delete: el profesional pudo atender casos referenciados). */
export async function setMemberStatus(id: string, status: "active" | "inactive"): Promise<TalentResult> {
  const { ctx, err } = await talentGuard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("team_member").update({ status, updated_by: ctx.accountId, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/talent/${id}`);
  revalidatePath("/talent");
  return { ok: true, id };
}

/** Competencia (skill) del profesional. Sin duplicar la misma skill. */
export async function addMemberSkill(memberId: string, input: SkillInput): Promise<TalentResult> {
  const { ctx, err } = await talentGuard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateSkill(input);
  if (v) return { ok: false, error: v };
  const { data: dup } = await ctx.supabase.from("member_skill").select("id").eq("member_id", memberId).eq("skill_id", input.skillId).maybeSingle();
  if (dup) return { ok: false, error: ErrorCode.DUPLICATE };
  const { error } = await ctx.supabase.from("member_skill").insert({ tenant_id: ctx.tenantId, member_id: memberId, skill_id: input.skillId, level: input.level });
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath(`/talent/${memberId}`);
  return { ok: true };
}

export async function removeMemberSkill(rowId: string, memberId: string): Promise<TalentResult> {
  const { ctx, err } = await talentGuard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("member_skill").delete().eq("id", rowId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/talent/${memberId}`);
  return { ok: true };
}

/** Experiencia en un maestro (proceso, area, producto, canal, tecnologia/servicio). */
export async function addMemberExpertise(memberId: string, input: ExpertiseInput): Promise<TalentResult> {
  const { ctx, err } = await talentGuard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateExpertise(input);
  if (v) return { ok: false, error: v };
  const { data: dup } = await ctx.supabase.from("member_expertise").select("id").eq("member_id", memberId).eq("entity_type", input.entityType).eq("entity_id", input.entityId).maybeSingle();
  if (dup) return { ok: false, error: ErrorCode.DUPLICATE };
  const { error } = await ctx.supabase.from("member_expertise").insert({ tenant_id: ctx.tenantId, member_id: memberId, entity_type: input.entityType, entity_id: input.entityId, level: input.level });
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath(`/talent/${memberId}`);
  return { ok: true };
}

export async function removeMemberExpertise(rowId: string, memberId: string): Promise<TalentResult> {
  const { ctx, err } = await talentGuard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("member_expertise").delete().eq("id", rowId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/talent/${memberId}`);
  return { ok: true };
}

/** Evaluacion: general o al cerrar caso/proyecto. Mide efectividad (performance) y empatia. */
export async function addMemberEvaluation(memberId: string, input: EvaluationInput): Promise<TalentResult> {
  const { ctx, err } = await talentGuard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateEvaluation(input);
  if (v) return { ok: false, error: v };
  const { error } = await ctx.supabase.from("member_evaluation").insert({
    tenant_id: ctx.tenantId,
    member_id: memberId,
    eval_type: input.evalType,
    performance_score: input.effectiveness ?? null,
    empathy_score: input.empathy ?? null,
    comment: input.comment?.trim() || null,
    entity_type: input.evalType === "general" ? null : (input.entityType || null),
    entity_id: input.evalType === "general" ? null : (input.entityId || null),
    period: new Date().toISOString().slice(0, 10),
    evaluator_user_id: ctx.accountId,
    created_by: ctx.accountId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/talent/${memberId}`);
  return { ok: true };
}

export async function deleteMemberEvaluation(evalId: string, memberId: string): Promise<TalentResult> {
  const { ctx, err } = await talentGuard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("member_evaluation").delete().eq("id", evalId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/talent/${memberId}`);
  return { ok: true };
}
