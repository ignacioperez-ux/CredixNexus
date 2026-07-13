import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getIncident, getComments, getLedgerForEntity, getSuggestedKnowledge } from "@/lib/incidents/queries";
import { getRiskEventForIncident } from "@/lib/risk/queries";
import { getProblemsForIncident } from "@/lib/problems/queries";
import { getEscalationsForIncident } from "@/lib/sla/queries";
import { getWorkflowsForIncident, getActiveDefinitions } from "@/lib/workflows/queries";
import { getChangesForIncident } from "@/lib/changes/queries";
import { getMajorIncidentForIncident } from "@/lib/major-incidents/queries";
import { getVendorForIncidentCi } from "@/lib/vendors/queries";
import { getIncidentEffort } from "@/lib/worklog/queries";
import { getCsatForIncident } from "@/lib/csat/queries";
import { getFinancialCaseForIncident } from "@/lib/fraud/queries";
import { getAttachments, getTasks } from "@/lib/casework/queries";
import { getAssignableMembers } from "@/lib/talent/queries";
import { getProjectsForIncident } from "@/lib/projects/queries";
import { IncidentDetail, type IncidentDetailData } from "@/components/incidents/detail/incident-detail";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;

  const inc = await getIncident(ctx.supabase, id);
  if (!inc) notFound();

  // Permisos desde la resolucion cacheada por request (session.ts): el layout ya llamo
  // my_permissions/my_roles, asi que esto no agrega viajes. Antes eran 11 RPC has_permission
  // dentro del Promise.all — el mayor costo de esta pagina.
  const access = await getAccessControl();
  const can = (code: string) => access.isAdmin || access.perms.includes(code);

  const [comments, ledger, knowledge, riskEvent, problems, escalations, workflows, workflowDefs, changes, majorIncident, vendor, effort, survey, financialCase, attachments, tasks, members, projects] = await Promise.all([
    getComments(ctx.supabase, id),
    getLedgerForEntity(ctx.supabase, id),
    getSuggestedKnowledge(ctx.supabase, (inc.category as string) ?? null, (inc.affected_ci_id as string) ?? null),
    getRiskEventForIncident(ctx.supabase, id),
    getProblemsForIncident(ctx.supabase, id),
    getEscalationsForIncident(ctx.supabase, id),
    getWorkflowsForIncident(ctx.supabase, id),
    getActiveDefinitions(ctx.supabase, "incident"),
    getChangesForIncident(ctx.supabase, id),
    getMajorIncidentForIncident(ctx.supabase, id),
    getVendorForIncidentCi(ctx.supabase, (inc.affected_ci_id as string) ?? null),
    getIncidentEffort(ctx.supabase, id),
    getCsatForIncident(ctx.supabase, id),
    getFinancialCaseForIncident(ctx.supabase, id),
    getAttachments(ctx.supabase, id),
    getTasks(ctx.supabase, id),
    getAssignableMembers(ctx.supabase),
    getProjectsForIncident(ctx.supabase, id),
  ]);

  const canManageRisk = can("risk.manage");
  const canManageProblem = can("problem.manage");
  const canRunWorkflow = can("workflow.run");
  const canManageChange = can("change.manage");
  const canManageMi = can("major_incident.manage");
  const canUpdateIncident = can("incident.update");
  const canTriage = can("triage.manage");
  const canLogWork = can("worklog.manage");
  const canSubmitCsat = can("survey.submit");
  const canManageFraud = can("fraud.manage");
  const canManageDispute = can("dispute.manage");
  const canManageTalent = can("talent.manage");

  return (
    <IncidentDetail
      inc={inc as unknown as IncidentDetailData}
      comments={comments as never}
      ledger={ledger as never}
      knowledge={knowledge}
      riskEvent={riskEvent}
      canManageRisk={canManageRisk}
      problems={problems}
      canManageProblem={canManageProblem}
      projects={projects}
      escalations={escalations}
      workflows={workflows}
      workflowDefs={workflowDefs}
      canRunWorkflow={canRunWorkflow}
      changes={changes}
      canManageChange={canManageChange}
      majorIncident={majorIncident}
      canManageMi={canManageMi}
      vendor={vendor}
      canUpdateIncident={canUpdateIncident}
      canTriage={canTriage}
      effort={effort}
      canLogWork={canLogWork}
      survey={survey}
      canSubmitCsat={canSubmitCsat}
      financialCase={financialCase}
      canManageFraud={canManageFraud}
      canManageDispute={canManageDispute}
      attachments={attachments}
      tasks={tasks}
      members={members}
      canManageTalent={canManageTalent}
    />
  );
}
