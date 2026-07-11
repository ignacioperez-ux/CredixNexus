import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
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
import { suggestForIncident } from "@/lib/talent/recommender";
import { IncidentDetail, type IncidentDetailData } from "@/components/incidents/detail/incident-detail";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;

  const inc = await getIncident(ctx.supabase, id);
  if (!inc) notFound();

  const [comments, ledger, knowledge, fit, riskEvent, canManageRisk, problems, canManageProblem, escalations, workflows, workflowDefs, canRunWorkflow, changes, canManageChange, majorIncident, canManageMi, vendor, canUpdateIncident, canTriage, effort, canLogWork, survey, canSubmitCsat, financialCase, canManageFraud, canManageDispute, attachments, tasks] = await Promise.all([
    getComments(ctx.supabase, id),
    getLedgerForEntity(ctx.supabase, id),
    getSuggestedKnowledge(ctx.supabase, (inc.category as string) ?? null, (inc.affected_ci_id as string) ?? null),
    suggestForIncident(ctx.supabase, id),
    getRiskEventForIncident(ctx.supabase, id),
    hasPermission(ctx.supabase, "risk.manage"),
    getProblemsForIncident(ctx.supabase, id),
    hasPermission(ctx.supabase, "problem.manage"),
    getEscalationsForIncident(ctx.supabase, id),
    getWorkflowsForIncident(ctx.supabase, id),
    getActiveDefinitions(ctx.supabase, "incident"),
    hasPermission(ctx.supabase, "workflow.run"),
    getChangesForIncident(ctx.supabase, id),
    hasPermission(ctx.supabase, "change.manage"),
    getMajorIncidentForIncident(ctx.supabase, id),
    hasPermission(ctx.supabase, "major_incident.manage"),
    getVendorForIncidentCi(ctx.supabase, (inc.affected_ci_id as string) ?? null),
    hasPermission(ctx.supabase, "incident.update"),
    hasPermission(ctx.supabase, "triage.manage"),
    getIncidentEffort(ctx.supabase, id),
    hasPermission(ctx.supabase, "worklog.manage"),
    getCsatForIncident(ctx.supabase, id),
    hasPermission(ctx.supabase, "survey.submit"),
    getFinancialCaseForIncident(ctx.supabase, id),
    hasPermission(ctx.supabase, "fraud.manage"),
    hasPermission(ctx.supabase, "dispute.manage"),
    getAttachments(ctx.supabase, id),
    getTasks(ctx.supabase, id),
  ]);

  return (
    <IncidentDetail
      inc={inc as unknown as IncidentDetailData}
      comments={comments as never}
      ledger={ledger as never}
      knowledge={knowledge}
      fit={fit}
      riskEvent={riskEvent}
      canManageRisk={canManageRisk}
      problems={problems}
      canManageProblem={canManageProblem}
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
    />
  );
}
