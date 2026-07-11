import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getProject, getProjectTasks, getProjectValidations } from "@/lib/projects/queries";
import { getWorkflowsForProject, getActiveDefinitions } from "@/lib/workflows/queries";
import { ProjectDetail, type ProjectDetailData } from "@/components/projects/project-detail";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  const project = await getProject(ctx.supabase, id);
  if (!project) notFound();

  const [tasks, validations, workflows, workflowDefs, canValidate, canDeploy, canRunWorkflow] = await Promise.all([
    getProjectTasks(ctx.supabase, id),
    getProjectValidations(ctx.supabase, id),
    getWorkflowsForProject(ctx.supabase, id),
    getActiveDefinitions(ctx.supabase, "project"),
    hasPermission(ctx.supabase, "project.validate"),
    hasPermission(ctx.supabase, "project.deploy"),
    hasPermission(ctx.supabase, "workflow.run"),
  ]);

  return (
    <ProjectDetail
      project={project as unknown as ProjectDetailData}
      tasks={tasks as never}
      validations={validations}
      workflows={workflows}
      workflowDefs={workflowDefs}
      qa={{ canValidate, canDeploy, canRunWorkflow }}
    />
  );
}
