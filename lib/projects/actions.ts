"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { ErrorCode, minLength, firstError } from "@/lib/validation";

export type ProjectResult = { ok: boolean; error?: string; id?: string };

export type ProjectInput = {
  name: string;
  description?: string;
  projectType?: string;
  squadId?: string;
  businessUnitId?: string;
  estimatedBenefitAmount?: number;
  estimatedCostAmount?: number;
  businessValue?: number;
  timeCriticality?: number;
  riskReduction?: number;
  jobSize?: number;
};

const orNull = (v?: string) => (v && v.length > 0 ? v : null);
const nonNeg = (n?: number) => (n ?? 0) >= 0;

function validate(i: ProjectInput): string | null {
  return firstError(
    minLength(i.name, 5),
    nonNeg(i.estimatedBenefitAmount) ? null : ErrorCode.FORMAT,
    nonNeg(i.estimatedCostAmount) ? null : ErrorCode.FORMAT,
    (i.jobSize ?? 1) >= 1 ? null : ErrorCode.FORMAT,
  );
}

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
  const { error } = await ctx.supabase.from("project").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  return { ok: true, id };
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
