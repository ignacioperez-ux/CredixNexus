import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { getProject, getProjectOptions } from "@/lib/projects/queries";
import { ProjectForm } from "@/components/projects/project-form";
import type { ProjectInput } from "@/lib/projects/actions";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  const [project, options] = await Promise.all([getProject(ctx.supabase, id), getProjectOptions(ctx.supabase)]);
  if (!project) notFound();

  const initial: Partial<ProjectInput> = {
    name: project.name,
    description: project.description ?? "",
    projectType: project.project_type,
    squadId: project.squad_id ?? "",
    businessUnitId: project.business_unit_id ?? "",
    estimatedBenefitAmount: Number(project.estimated_benefit_amount ?? 0),
    estimatedCostAmount: Number(project.estimated_cost_amount ?? 0),
    businessValue: project.business_value,
    timeCriticality: project.time_criticality,
    riskReduction: project.risk_reduction,
    jobSize: project.job_size,
  };
  return <ProjectForm options={options} mode="edit" projectId={id} initial={initial} />;
}
