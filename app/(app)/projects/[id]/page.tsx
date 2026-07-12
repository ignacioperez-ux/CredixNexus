import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getProject, getProjectTasks, getProjectValidations } from "@/lib/projects/queries";
import { getWorkflowsForProject, getActiveDefinitions } from "@/lib/workflows/queries";
import { ProjectDetail, type ProjectDetailData } from "@/components/projects/project-detail";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  const project = await getProject(ctx.supabase, id);
  if (!project) notFound();

  // Permisos desde la resolucion cacheada por request (session.ts): 0 viajes extra.
  const access = await getAccessControl();
  const can = (code: string) => access.isAdmin || access.perms.includes(code);

  const [tasks, validations, workflows, workflowDefs] = await Promise.all([
    getProjectTasks(ctx.supabase, id),
    getProjectValidations(ctx.supabase, id),
    getWorkflowsForProject(ctx.supabase, id),
    getActiveDefinitions(ctx.supabase, "project"),
  ]);
  const canValidate = can("project.validate");
  const canDeploy = can("project.deploy");
  const canRunWorkflow = can("workflow.run");

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
