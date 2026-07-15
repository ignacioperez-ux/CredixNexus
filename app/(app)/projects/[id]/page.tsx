import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getProject, getProjectTasks, getProjectValidations, getAnchorCaseContext, getProjectSquads, getProjectOptions, getProjectRisks } from "@/lib/projects/queries";
import { getWorkflowsForProject, getActiveDefinitions } from "@/lib/workflows/queries";
import { getSquadRoster, type RosterRow } from "@/lib/squads/queries";
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
  const squadId = (project as { squad_id?: string | null }).squad_id ?? null;

  const anchorIncidentId = (project as { incident?: { id: string } | null }).incident?.id ?? null;
  const [tasks, validations, workflows, workflowDefs, roster, anchor, initiativeSquads, options, risks] = await Promise.all([
    getProjectTasks(ctx.supabase, id),
    getProjectValidations(ctx.supabase, id),
    getWorkflowsForProject(ctx.supabase, id),
    getActiveDefinitions(ctx.supabase, "project"),
    squadId ? getSquadRoster(ctx.supabase, squadId) : Promise.resolve([] as RosterRow[]),
    anchorIncidentId ? getAnchorCaseContext(ctx.supabase, anchorIncidentId) : Promise.resolve(null),
    getProjectSquads(ctx.supabase, id),
    getProjectOptions(ctx.supabase),
    getProjectRisks(ctx.supabase, id),
  ]);
  const canValidate = can("project.validate");
  const canDeploy = can("project.deploy");
  const canRunWorkflow = can("workflow.run");
  const squadMembers = (roster as RosterRow[])
    .filter((r) => r.status === "active" && r.member)
    .map((r) => ({ id: r.member!.id, name: r.member!.name }));

  return (
    <ProjectDetail
      project={project as unknown as ProjectDetailData}
      tasks={tasks as never}
      validations={validations}
      workflows={workflows}
      workflowDefs={workflowDefs}
      qa={{ canValidate, canDeploy, canRunWorkflow }}
      squadMembers={squadMembers}
      canManageTalent={can("talent.manage")}
      canManage={can("project.manage")}
      canReadIncident={can("incident.read")}
      anchor={anchor}
      initiativeSquads={initiativeSquads}
      squadOptions={options.squads}
      risks={risks}
    />
  );
}
