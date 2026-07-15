"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { ErrorCode, minLength, firstError } from "@/lib/validation";

async function canManageProject(): Promise<boolean> {
  const a = await getAccessControl();
  return a.isAdmin || a.perms.includes("project.manage");
}

export type ProjectResult = { ok: boolean; error?: string; id?: string };

export type ProjectInput = {
  name: string;
  description?: string;
  projectType?: string;
  squadId?: string;
  businessUnitId?: string;
  estimatedBenefitAmount?: number;
  estimatedCostAmount?: number;
  actualBenefitAmount?: number | null;
  actualCostAmount?: number | null;
  businessValue?: number;
  timeCriticality?: number;
  riskReduction?: number;
  jobSize?: number;
};

const orNull = (v?: string) => (v && v.length > 0 ? v : null);
const nonNeg = (n?: number) => (n ?? 0) >= 0;

// Actual: opcional (null = aun no medido); si viene, no negativo.
const optNonNeg = (n?: number | null) => n == null || (n >= 0 && !Number.isNaN(n));

function validate(i: ProjectInput): string | null {
  return firstError(
    minLength(i.name, 5),
    nonNeg(i.estimatedBenefitAmount) ? null : ErrorCode.FORMAT,
    nonNeg(i.estimatedCostAmount) ? null : ErrorCode.FORMAT,
    optNonNeg(i.actualBenefitAmount) ? null : ErrorCode.FORMAT,
    optNonNeg(i.actualCostAmount) ? null : ErrorCode.FORMAT,
    (i.jobSize ?? 1) >= 1 ? null : ErrorCode.FORMAT,
  );
}

// Actual -> columna: null explicito si no se informa (no lo forzamos a 0, seria "medido = 0").
const actualCols = (i: ProjectInput) => ({
  actual_benefit_amount: i.actualBenefitAmount == null ? null : i.actualBenefitAmount,
  actual_cost_amount: i.actualCostAmount == null ? null : i.actualCostAmount,
});

function wsjfCols(i: ProjectInput) {
  return {
    business_value: Math.max(0, i.businessValue ?? 0),
    time_criticality: Math.max(0, i.timeCriticality ?? 0),
    risk_reduction: Math.max(0, i.riskReduction ?? 0),
    job_size: Math.max(1, i.jobSize ?? 1),
  };
}

export async function createProject(input: ProjectInput): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const { data, error } = await ctx.supabase
    .from("project")
    .insert({
      tenant_id: ctx.tenantId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      project_type: input.projectType || "evolution",
      source_type: "manual",
      status: "proposed",
      squad_id: orNull(input.squadId),
      business_unit_id: orNull(input.businessUnitId),
      estimated_benefit_amount: input.estimatedBenefitAmount ?? 0,
      estimated_cost_amount: input.estimatedCostAmount ?? 0,
      ...wsjfCols(input),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/projects");
  return { ok: true, id: data.id as string };
}

export async function updateProject(id: string, input: ProjectInput): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const { error } = await ctx.supabase
    .from("project")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      squad_id: orNull(input.squadId),
      business_unit_id: orNull(input.businessUnitId),
      estimated_benefit_amount: input.estimatedBenefitAmount ?? 0,
      estimated_cost_amount: input.estimatedCostAmount ?? 0,
      ...actualCols(input),
      ...wsjfCols(input),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  return { ok: true, id };
}

export async function softDeleteProject(id: string): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  const { error } = await ctx.supabase.from("project").update({ status: "cancelled" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/projects");
  return { ok: true, id };
}

export async function changeProjectStatus(id: string, status: string): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  const patch: Record<string, unknown> = { status };
  if (status === "active") patch.actual_start = new Date().toISOString().slice(0, 10);
  if (status === "completed") patch.actual_end = new Date().toISOString().slice(0, 10);
  const { data: proj, error } = await ctx.supabase.from("project").update(patch).eq("id", id).select("name, created_from_incident_id").single();
  if (error) return { ok: false, error: error.message };
  // Campanita v2: al COMPLETAR una evolucion, avisa a Operaciones y al RC que cierra el hilo (§0).
  if (status === "completed") {
    const link = proj?.created_from_incident_id ? `/incidents/${proj.created_from_incident_id}` : `/projects/${id}`;
    const body = `El proyecto de evolucion "${proj?.name ?? ""}" fue completado.`;
    for (const role of ["support_lead", "responsable_comercial"]) {
      await ctx.supabase.rpc("notify_role", {
        p_role_code: role, p_type: "evolution_completed", p_title: "Evolucion completada",
        p_body: body, p_entity_type: "project", p_entity_id: id, p_link: link, p_severity: "success",
      });
    }
  }
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  return { ok: true, id };
}

// ---- Iniciativa 360 (Fase 2): squads involucrados (N:N) ------------------------
/** Agrega un squad a la iniciativa (contribuyente por defecto). Unico por (project, squad). */
export async function addProjectSquad(projectId: string, squadId: string, role: "lead" | "contributing" = "contributing"): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await canManageProject())) return { ok: false, error: ErrorCode.PERMISSION };
  if (!squadId) return { ok: false, error: ErrorCode.REQUIRED };
  const { error } = await ctx.supabase.from("project_squad").insert({ tenant_id: ctx.tenantId, project_id: projectId, squad_id: squadId, role });
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: projectId };
}

export async function removeProjectSquad(linkId: string, projectId: string): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await canManageProject())) return { ok: false, error: ErrorCode.PERMISSION };
  const { error } = await ctx.supabase.from("project_squad").delete().eq("id", linkId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: projectId };
}

/** Fija el squad LEAD: el elegido pasa a lead, los demas a contribuyente, y project.lead_squad_id. */
export async function setInitiativeLead(projectId: string, squadId: string): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await canManageProject())) return { ok: false, error: ErrorCode.PERMISSION };
  await ctx.supabase.from("project_squad").update({ role: "contributing" }).eq("project_id", projectId).eq("role", "lead");
  await ctx.supabase.from("project_squad").update({ role: "lead" }).eq("project_id", projectId).eq("squad_id", squadId);
  await ctx.supabase.from("project").update({ lead_squad_id: squadId, squad_id: squadId }).eq("id", projectId);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: projectId };
}

/** % de dedicacion de un squad a la iniciativa (0-100). */
export async function updateProjectSquadAllocation(linkId: string, projectId: string, allocationPct: number): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await canManageProject())) return { ok: false, error: ErrorCode.PERMISSION };
  const pct = Math.round(allocationPct);
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) return { ok: false, error: ErrorCode.FORMAT };
  const { error } = await ctx.supabase.from("project_squad").update({ allocation_pct: pct, updated_by: ctx.accountId }).eq("id", linkId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: projectId };
}

// ---- Iniciativa 360 (Fase 2): blockers / riesgos / dependencias ------------------
const RISK_KINDS = ["blocker", "risk", "dependency"];
const RISK_SEV = ["low", "medium", "high", "critical"];
const RISK_ST = ["open", "mitigating", "resolved"];
export type RiskInput = { kind: string; title: string; description?: string; severity: string; relatedSquadId?: string; dueDate?: string };

export async function addProjectRisk(projectId: string, input: RiskInput): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await canManageProject())) return { ok: false, error: ErrorCode.PERMISSION };
  const err = firstError(
    minLength(input.title, 3),
    RISK_KINDS.includes(input.kind) ? null : ErrorCode.FORMAT,
    RISK_SEV.includes(input.severity) ? null : ErrorCode.FORMAT,
  );
  if (err) return { ok: false, error: err };
  const { error } = await ctx.supabase.from("project_risk").insert({
    tenant_id: ctx.tenantId, project_id: projectId, kind: input.kind, title: input.title.trim(),
    description: input.description?.trim() || null, severity: input.severity,
    related_squad_id: input.kind === "dependency" ? (input.relatedSquadId || null) : null,
    due_date: input.dueDate || null, created_by: ctx.accountId, updated_by: ctx.accountId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: projectId };
}

export async function setProjectRiskStatus(id: string, projectId: string, status: string): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await canManageProject())) return { ok: false, error: ErrorCode.PERMISSION };
  if (!RISK_ST.includes(status)) return { ok: false, error: ErrorCode.FORMAT };
  const { error } = await ctx.supabase.from("project_risk").update({ status, updated_by: ctx.accountId, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: projectId };
}

export async function removeProjectRisk(id: string, projectId: string): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await canManageProject())) return { ok: false, error: ErrorCode.PERMISSION };
  const { error } = await ctx.supabase.from("project_risk").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: projectId };
}

export async function addProjectTask(projectId: string, title: string): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  const err = minLength(title, 3);
  if (err) return { ok: false, error: err };
  const { error } = await ctx.supabase.from("project_task").insert({
    tenant_id: ctx.tenantId,
    project_id: projectId,
    title: title.trim(),
    status: "todo",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function setTaskStatus(taskId: string, projectId: string, status: string): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  const { error } = await ctx.supabase
    .from("project_task")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Guarda el caso de negocio (revisado por el humano) en project.business_case. */
export async function saveBusinessCase(projectId: string, narrative: string): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!narrative || narrative.trim().length < 10) return { ok: false, error: ErrorCode.REQUIRED };
  const { error } = await ctx.supabase
    .from("project")
    .update({ business_case: { narrative: narrative.trim() } })
    .eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: projectId };
}

/** Convierte una recomendacion aprobada (por el RC) en un proyecto atendido por un squad. */
export async function convertRecommendation(recoId: string, squadId: string): Promise<ProjectResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };

  const { data: reco } = await ctx.supabase
    .from("project_recommendation")
    .select("id, incident_id, rule_evaluation_id, recommended_name, recommended_project_type, transformation_score, recommendation_status, created_project_id")
    .eq("id", recoId)
    .maybeSingle();
  if (!reco) return { ok: false, error: "not_found" };
  if (reco.recommendation_status !== "approved" || reco.created_project_id) {
    return { ok: false, error: "ERR_STATE_TRANSITION" };
  }

  const { data: inc } = await ctx.supabase
    .from("incident")
    .select("affected_business_unit_id, affected_product_id")
    .eq("id", reco.incident_id)
    .maybeSingle();

  const { data: proj, error } = await ctx.supabase
    .from("project")
    .insert({
      tenant_id: ctx.tenantId,
      name: reco.recommended_name,
      project_type: reco.recommended_project_type || "evolution",
      source_type: "incident",
      status: "active",
      squad_id: orNull(squadId),
      business_unit_id: inc?.affected_business_unit_id ?? null,
      product_id: inc?.affected_product_id ?? null,
      business_value: 5,
      time_criticality: 5,
      risk_reduction: 5,
      job_size: 5,
      created_from_incident_id: reco.incident_id,
      created_from_recommendation_id: reco.id,
      created_from_rule_evaluation_id: reco.rule_evaluation_id,
      actual_start: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await ctx.supabase.from("project_recommendation").update({ created_project_id: proj.id, recommendation_status: "converted" }).eq("id", recoId);
  await ctx.supabase.from("project_incident_link").insert({ tenant_id: ctx.tenantId, project_id: proj.id, incident_id: reco.incident_id, link_type: "source" });

  revalidatePath("/projects");
  revalidatePath("/rules");
  return { ok: true, id: proj.id as string };
}
