"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { ErrorCode } from "@/lib/validation";
import { suggestForIncident, type FitSuggestion } from "@/lib/talent/recommender";
import { assignmentEditable, mustKeepAtLeastOne } from "@/lib/incidents/transitions";
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

// ---- Asignacion de responsables al caso (A3: principal + colaboradores) ----------
type AsgCtx = NonNullable<Awaited<ReturnType<typeof getContext>>>;

/** Guard comun de las mutaciones de asignacion: permiso + caso existente + edicion permitida
 *  (solo lectura en Resuelto/Cerrado/Cancelado/En Evolucion). */
async function assignmentCtx(incidentId: string): Promise<{ ctx: AsgCtx; inc: { status: string; assigned_member_id: string | null } } | { error: string }> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { error: ErrorCode.PERMISSION };
  const access = await getAccessControl();
  // Asignar/reasignar es potestad de la Gerencia (no del Operador, aunque tenga incident.update).
  const allowed = access.isAdmin || ["incident.assign", "triage.manage", "talent.manage"].some((c) => access.perms.includes(c));
  if (!allowed) return { error: ErrorCode.PERMISSION };
  const { data: inc } = await ctx.supabase.from("incident").select("status, assigned_member_id").eq("id", incidentId).maybeSingle();
  if (!inc) return { error: "not_found" };
  if (!assignmentEditable(inc.status as string)) return { error: "ERR_ASSIGNMENT_LOCKED" };
  return { ctx, inc: { status: inc.status as string, assigned_member_id: (inc.assigned_member_id as string | null) ?? null } };
}

async function memberName(ctx: AsgCtx, memberId: string): Promise<string> {
  const { data } = await ctx.supabase.from("team_member").select("name").eq("id", memberId).maybeSingle();
  return (data?.name as string) ?? "recurso";
}
async function asgComment(ctx: AsgCtx, incidentId: string, body: string) {
  await ctx.supabase.from("incident_comment").insert({ tenant_id: ctx.tenantId, incident_id: incidentId, author_user_id: ctx.accountId, body, visibility: "internal", is_system_generated: true });
}
function asgDone(incidentId: string) {
  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/incidents");
  return { ok: true as const };
}

/** Fija a `memberId` como PRINCIPAL del caso (lo agrega si no estaba). Espeja assigned_member_id y,
 *  si el caso aun no estaba asignado (new/triaged), lo pasa a "assigned". Usado por lista, panel
 *  rapido y el boton "Asignar/Hacer principal" del detalle. `viaSuggestion` solo cambia la nota. */
export async function assignIncidentMember(incidentId: string, memberId: string, viaSuggestion = false): Promise<{ ok: boolean; error?: string }> {
  if (!memberId) return { ok: false, error: ErrorCode.REQUIRED };
  const g = await assignmentCtx(incidentId);
  if ("error" in g) return { ok: false, error: g.error };
  const { ctx, inc } = g;
  // Demote principal actual y upsert del objetivo como principal.
  await ctx.supabase.from("incident_assignee").update({ is_primary: false }).eq("incident_id", incidentId).eq("is_primary", true);
  const { error } = await ctx.supabase.from("incident_assignee")
    .upsert({ tenant_id: ctx.tenantId, incident_id: incidentId, member_id: memberId, is_primary: true, created_by: ctx.accountId }, { onConflict: "incident_id,member_id" });
  if (error) return { ok: false, error: error.message };
  const patch: Record<string, unknown> = { assigned_member_id: memberId };
  if (inc.status === "new" || inc.status === "triaged") patch.status = "assigned";
  await ctx.supabase.from("incident").update(patch).eq("id", incidentId);
  await asgComment(ctx, incidentId, viaSuggestion ? `Responsable principal: ${await memberName(ctx, memberId)} (tomando la sugerencia del sistema).` : `Responsable principal: ${await memberName(ctx, memberId)}.`);
  return asgDone(incidentId);
}

/** Agrega un colaborador. Si el caso no tenia responsables, este queda de principal. */
export async function addCaseAssignee(incidentId: string, memberId: string): Promise<{ ok: boolean; error?: string }> {
  if (!memberId) return { ok: false, error: ErrorCode.REQUIRED };
  const g = await assignmentCtx(incidentId);
  if ("error" in g) return { ok: false, error: g.error };
  const { ctx } = g;
  const { count } = await ctx.supabase.from("incident_assignee").select("id", { count: "exact", head: true }).eq("incident_id", incidentId);
  const first = (count ?? 0) === 0;
  const { error } = await ctx.supabase.from("incident_assignee")
    .insert({ tenant_id: ctx.tenantId, incident_id: incidentId, member_id: memberId, is_primary: first, created_by: ctx.accountId });
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  const name = await memberName(ctx, memberId);
  if (first) {
    await ctx.supabase.from("incident").update({ assigned_member_id: memberId, status: g.inc.status === "new" || g.inc.status === "triaged" ? "assigned" : g.inc.status }).eq("id", incidentId);
    await asgComment(ctx, incidentId, `Responsable principal: ${name}.`);
  } else {
    await asgComment(ctx, incidentId, `Colaborador agregado: ${name}.`);
  }
  return asgDone(incidentId);
}

/** Quita un responsable. No puede dejar cero si el estado ya exige responsable (>= Asignado).
 *  Si se quita el principal y quedan otros, se promueve al mas antiguo. */
export async function removeCaseAssignee(incidentId: string, memberId: string): Promise<{ ok: boolean; error?: string }> {
  const g = await assignmentCtx(incidentId);
  if ("error" in g) return { ok: false, error: g.error };
  const { ctx, inc } = g;
  const { data: rows } = await ctx.supabase.from("incident_assignee").select("id, member_id, is_primary, created_at").eq("incident_id", incidentId).order("created_at", { ascending: true });
  const list = (rows ?? []) as { id: string; member_id: string; is_primary: boolean; created_at: string }[];
  const target = list.find((r) => r.member_id === memberId);
  if (!target) return { ok: false, error: "not_found" };
  if (list.length === 1 && mustKeepAtLeastOne(inc.status)) return { ok: false, error: "ERR_KEEP_ONE_ASSIGNEE" };
  const { error } = await ctx.supabase.from("incident_assignee").delete().eq("id", target.id);
  if (error) return { ok: false, error: error.message };
  const rest = list.filter((r) => r.member_id !== memberId);
  if (target.is_primary) {
    const next = rest[0] ?? null; // mas antiguo
    if (next) {
      await ctx.supabase.from("incident_assignee").update({ is_primary: true }).eq("id", next.id);
      await ctx.supabase.from("incident").update({ assigned_member_id: next.member_id }).eq("id", incidentId);
    } else {
      await ctx.supabase.from("incident").update({ assigned_member_id: null }).eq("id", incidentId);
    }
  }
  await asgComment(ctx, incidentId, `Responsable removido: ${await memberName(ctx, memberId)}.`);
  return asgDone(incidentId);
}

/** Promueve a un colaborador existente a responsable PRINCIPAL (espeja assigned_member_id). */
export async function setPrimaryAssignee(incidentId: string, memberId: string): Promise<{ ok: boolean; error?: string }> {
  const g = await assignmentCtx(incidentId);
  if ("error" in g) return { ok: false, error: g.error };
  const { ctx } = g;
  const { data: exists } = await ctx.supabase.from("incident_assignee").select("id").eq("incident_id", incidentId).eq("member_id", memberId).maybeSingle();
  if (!exists) return { ok: false, error: "not_found" };
  await ctx.supabase.from("incident_assignee").update({ is_primary: false }).eq("incident_id", incidentId).eq("is_primary", true);
  const { error } = await ctx.supabase.from("incident_assignee").update({ is_primary: true }).eq("id", exists.id);
  if (error) return { ok: false, error: error.message };
  await ctx.supabase.from("incident").update({ assigned_member_id: memberId }).eq("id", incidentId);
  await asgComment(ctx, incidentId, `Responsable principal: ${await memberName(ctx, memberId)}.`);
  return asgDone(incidentId);
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
