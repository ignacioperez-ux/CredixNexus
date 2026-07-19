"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { PriorityTag } from "../badges";
import { CommentThread } from "./comment-thread";
import { StatusActions } from "./status-actions";
import { StatusStepper } from "./status-stepper";
import { RecurrenceReview } from "./recurrence-review";
import { AssignResponsible } from "./assign-responsible";
import type { IncidentAssignee } from "@/lib/incidents/assignees";
import { assignmentEditable } from "@/lib/incidents/transitions";
import { EvaluateMemberPanel } from "@/components/talent/evaluate-member-panel";
import type { AssignableMember } from "@/lib/talent/queries";
import { EvolutionPanel } from "./evolution-panel";
import { EvaluatePanel } from "@/components/rules/evaluate-panel";
import { AiRca } from "./ai-rca";
import { AiKb } from "./ai-kb";
import { AiExecSummary } from "./ai-exec-summary";
import { AiInsights } from "@/components/ai/ai-insights";
import { BackButton } from "@/components/common/back-button";
import { TriagePanel } from "@/components/triage/triage-panel";
import { WorkLog } from "@/components/worklog/work-log";
import type { IncidentEffort } from "@/lib/worklog/queries";
import { CsatPanel } from "@/components/csat/csat-panel";
import type { CsatSurvey } from "@/lib/csat/queries";
import { RiskLink } from "@/components/risk/risk-link";
import { ProblemLink } from "@/components/problems/problem-link";
import { IncidentEscalations } from "@/components/sla/incident-escalations";
import { SlaStatusRow } from "@/components/sla/sla-status";
import { InfoTip } from "@/components/help/info-tip";
import { IncidentWorkflows } from "@/components/workflows/incident-workflows";
import { ChangeLink } from "@/components/changes/change-link";
import { DeclareMi } from "@/components/major-incidents/declare-mi";
import { FinancialCaseLink, type FinancialCase } from "@/components/fraud/financial-case-link";
import { Icon } from "@/components/ui/icon";
import type { IncidentProject } from "@/lib/projects/queries";
import type { Macro } from "@/lib/macros/queries";
import { Attachments } from "./attachments";
import { CaseTasks } from "./case-tasks";
import { DuplicatesPanel } from "./duplicates-panel";
import type { Attachment, ChecklistData } from "@/lib/casework/queries";
import type { DuplicateLinks } from "@/lib/incidents/duplicates";

type Named = { name: string } | null;

export type IncidentDetailData = {
  id: string;
  incident_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  impact: string;
  urgency: string;
  transformation_score: number;
  transformation_candidate: boolean;
  financial_impact_estimate: number;
  affected_transaction_count: number;
  partner_impact: boolean;
  opened_at: string;
  sla_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  resolved_at: string | null;
  root_cause_summary: string | null;
  case_type: string;
  amount: number | null;
  currency: string;
  transaction_reference: string | null;
  customer_name: string | null;
  risk_score: number | null;
  sensitive_flag: boolean;
  pii_flag: boolean;
  affected_party_id: string | null;
  category: ({ name: string; default_team: string | null; requires_rca: boolean; requires_kb: boolean }) | null;
  ci: ({ name: string; ci_type: string }) | null;
  service: Named;
  product: Named;
  channel: Named;
  business_unit: Named;
  reporter: ({ full_name: string }) | null;
  area: ({ name: string; code: string }) | null;
  is_recurrence: boolean;
  recurrence_of: ({ id: string; incident_number: string; title: string }) | null;
  recurrence_review_note: string | null;
  recurrence_reviewed_at: string | null;
  recurrence_reviewer: ({ full_name: string }) | null;
  intake_status: string;
  classified_as: string | null;
  assigned_member_id: string | null;
  assignee: { name: string } | null;
};

type Comment = { id: string; body: string; visibility: string; is_system_generated: boolean; created_at: string; author: { full_name: string } | null };
type LedgerRow = { block_height: number; action: string; actor_type: string; current_hash: string; timestamp: string };
type Kb = { id: string; article_number: string; title: string; category: string };

type RiskLinked = { id: string; event_number: string; status: string } | null;
type ProblemLinked = { id: string; problem_number: string; title: string; status: string; known_error: boolean };
type EscalationView = { id: string; sla_type: string; threshold_pct: number; elapsed_pct: number; action: string; acknowledged: boolean; triggered_at: string; rule: { code: string; name: string } | null };
type WfLinked = { id: string; instance_number: string; title: string; status: string; definition: { name: string } | null };
type WfDef = { id: string; code: string; name: string };
type ChangeLinked = { id: string; change_number: string; title: string; status: string; risk_level: string };
type MiLinked = { id: string; mi_number: string; severity: string; status: string } | null;
type VendorChip = { id: string; name: string; criticality: string } | null;

export function IncidentDetail({ inc, comments, ledger, knowledge = [], riskEvent = null, canManageRisk = false, problems = [], canManageProblem = false, projects = [], escalations = [], workflows = [], workflowDefs = [], canRunWorkflow = false, changes = [], canManageChange = false, majorIncident = null, canManageMi = false, vendor = null, canUpdateIncident = false, canTriage = false, effort, canLogWork = false, survey = null, canSubmitCsat = false, financialCase = null, canManageFraud = false, canManageDispute = false, attachments = [], tasks, members = [], canManageTalent = false, macros = [], assignees = [], caseTypeName = "", canManageAssign = false, duplicateLinks = { duplicateOf: null, primaryOf: [] } }: { inc: IncidentDetailData; comments: Comment[]; ledger: LedgerRow[]; knowledge?: Kb[]; riskEvent?: RiskLinked; canManageRisk?: boolean; problems?: ProblemLinked[]; canManageProblem?: boolean; projects?: IncidentProject[]; escalations?: EscalationView[]; workflows?: WfLinked[]; workflowDefs?: WfDef[]; canRunWorkflow?: boolean; changes?: ChangeLinked[]; canManageChange?: boolean; majorIncident?: MiLinked; canManageMi?: boolean; vendor?: VendorChip; canUpdateIncident?: boolean; canTriage?: boolean; effort?: IncidentEffort; canLogWork?: boolean; survey?: CsatSurvey | null; canSubmitCsat?: boolean; financialCase?: FinancialCase; canManageFraud?: boolean; canManageDispute?: boolean; attachments?: Attachment[]; tasks?: ChecklistData; members?: AssignableMember[]; canManageTalent?: boolean; macros?: Macro[]; assignees?: IncidentAssignee[]; caseTypeName?: string; canManageAssign?: boolean; duplicateLinks?: DuplicateLinks }) {
  const { t, locale } = useI18n();

  // Caso con relevancia financiera (monto / caso financiero / risk score): abre el caso financiero.
  const hasFinancial = !!financialCase || inc.amount != null || inc.risk_score != null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/incidents" />

      {/* Admision: si el caso aun no fue triado, primero se valida (admitir/descartar) */}
      {inc.intake_status === "pending" && canTriage && (
        <TriagePanel incidentId={inc.id} knowledge={knowledge} />
      )}

      {/* Header (persistente en ambas pestañas) */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-2)" }}>{inc.incident_number}</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.3px", margin: 0, color: "var(--text)" }}>{inc.title}</h1>
          {/* Tipo de caso: chip GRIS con icono (dato de clasificacion). Se distingue del ESTADO
              del flujo (stepper de color) y de la prioridad (badge de color) — C2. */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: "var(--muted)", background: "var(--paper)", border: "1px solid var(--line)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>
            <Icon name="inbox" size={11} color="var(--muted)" /> {caseTypeName || inc.case_type}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <StatusStepper status={inc.status} />
            <InfoTip tip="inc.tip.stepper" />
          </span>
          <PriorityTag priority={inc.priority} />
          {inc.intake_status === "pending" && <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "var(--accent-2)", background: "var(--accent-soft)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t("tri.pending")}</span>}
          {inc.intake_status === "discarded" && <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", background: "var(--paper)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t("tri.discarded")}</span>}
          {inc.classified_as && inc.intake_status === "accepted" && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--st-info)", background: "var(--st-info-bg)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t(("tri.class." + inc.classified_as) as MessageKey)}</span>}
        </div>
        {(canUpdateIncident || canTriage) && <StatusActions incidentId={inc.id} status={inc.status} hasAssignee={!!inc.assigned_member_id} />}
      </div>

      {/* Banner: si el caso es duplicado de otro, visible de inmediato (nunca perder el hilo) */}
      {duplicateLinks.duplicateOf && (
        <Link href={`/incidents/${duplicateLinks.duplicateOf.incident_id}`} className="cx-lift"
          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, background: "var(--st-medium-bg)", border: "1px solid var(--st-medium)", borderRadius: "var(--r-md)", padding: "10px 14px" }}>
          <Icon name="inbox" size={14} color="var(--st-medium-fg)" />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--st-medium-fg)" }}>{t("dup.is_duplicate_of")}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)" }}>{duplicateLinks.duplicateOf.incident_number}</span>
          <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{duplicateLinks.duplicateOf.title}</span>
        </Link>
      )}

      {/* Reincidencia: banner + gobierno de edicion (Gerencia con motivo obligatorio). */}
      <RecurrenceReview incidentId={inc.id} isRecurrence={inc.is_recurrence} priorCase={inc.recurrence_of}
        reviewNote={inc.recurrence_review_note} reviewedAt={inc.recurrence_reviewed_at}
        reviewerName={inc.recurrence_reviewer?.full_name ?? null} canManage={canManageAssign} />

      {/* Vista unica de gestion del caso */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card title={t("inc.field.description")}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text)" }}>{inc.description}</p>
            </Card>

            <Card title={t("inc.section.affected")}>
              <Row label={t("inc.field.app")} value={inc.ci?.name} />
              {vendor && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("vnd.provider")}</span>
                  <Link href={`/vendors/${vendor.id}`} style={{ fontSize: 12.5, color: "var(--accent-2)", textDecoration: "none", fontWeight: 600 }}>{vendor.name}</Link>
                </div>
              )}
              <Row label={t("inc.field.service")} value={inc.service?.name} />
              <Row label={t("inc.field.product")} value={inc.product?.name} />
              <Row label={t("inc.field.channel")} value={inc.channel?.name} />
              <Row label={t("inc.field.bu")} value={inc.business_unit?.name} />
              <Row label={t("inc.reported")} value={inc.reporter?.full_name} />
            </Card>

            <Card title={`${t("task.section")}${tasks && tasks.tasks.length > 0 ? ` (${tasks.done}/${tasks.open + tasks.done})` : ""}`}>
              <CaseTasks incidentId={inc.id} data={tasks ?? { tasks: [], open: 0, done: 0, progress: null }} canManage={canUpdateIncident} />
            </Card>

            <Card title={`${t("att.section")}${attachments.length > 0 ? ` (${attachments.length})` : ""}`}>
              <Attachments incidentId={inc.id} attachments={attachments} canManage={canUpdateIncident} />
            </Card>

            <Card title={t("inc.section.timeline")}>
              {/* Macros: solo para quien ATIENDE el caso (Gerencia de Operaciones = assign/triage,
                  operador = incident.update). Otros roles que ven el caso no tienen la opcion. */}
              <CommentThread incidentId={inc.id} comments={comments} macros={(canUpdateIncident || canManageAssign) ? macros : []} />
            </Card>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <AssignResponsible incidentId={inc.id} members={members} assignees={assignees} editable={assignmentEditable(inc.status)} canAssign={canManageAssign} />
            {(inc.status === "resolved" || inc.status === "closed") && inc.assigned_member_id && inc.assignee && canManageTalent && (
              <EvaluateMemberPanel members={[{ id: inc.assigned_member_id, name: inc.assignee.name }]} entityType="incident" entityId={inc.id} title={t("eval.title.incident")} />
            )}

            {(canManageAssign || duplicateLinks.duplicateOf || duplicateLinks.primaryOf.length > 0) && (
              <Card title={t("dup.section")} tip="inc.tip.duplicates">
                <DuplicatesPanel incidentId={inc.id} incidentTitle={inc.title} links={duplicateLinks} canManage={canManageAssign} />
              </Card>
            )}

            <Card title="SLA">
              <SlaStatusRow label={t("inc.sla.response")} dueAt={inc.sla_response_due_at} openedAt={inc.opened_at} resolvedAt={inc.resolved_at} status={inc.status} locale={locale} />
              <SlaStatusRow label={t("inc.sla.resolution")} dueAt={inc.sla_resolution_due_at} openedAt={inc.opened_at} resolvedAt={inc.resolved_at} status={inc.status} locale={locale} last />
            </Card>

            <Card title={t("sla.section.escalations")}>
              <IncidentEscalations escalations={escalations} />
            </Card>

            {effort && (
              <Card title={t("wl2.title")} tip="inc.tip.effort">
                <WorkLog incidentId={inc.id} effort={effort} canLog={canLogWork} />
              </Card>
            )}

            {(survey || inc.status === "resolved" || inc.status === "closed") && (
              <Card title={t("csat.title")}>
                <CsatPanel incidentId={inc.id} survey={survey} canSubmit={canSubmitCsat} />
              </Card>
            )}

            <Card title={t("inc.section.ledger")}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ledger.map((l) => (
                  <div key={l.block_height} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", width: 34 }}>#{l.block_height}</span>
                    <span style={{ color: "var(--text)", flex: 1 }}>{l.action}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-2)", fontSize: 10.5 }}>{l.current_hash.slice(0, 10)}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 10.5 }}>{new Date(l.timestamp).toLocaleString(locale)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

      {/* Vinculos y analisis del caso: modulos plegables (vacio -> cerrado). Antes vivian en una
          pestaña "Analisis y vinculos" separada; ahora forman parte de la misma vista de gestion. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(majorIncident || inc.priority === "p1_critical" || canManageMi) && (
            <Collapsible title={t("mi.section.incident")} tip="inc.tip.mi" count={majorIncident ? 1 : 0} defaultOpen={!!majorIncident}>
              <DeclareMi incidentId={inc.id} incidentTitle={inc.title} isP1={inc.priority === "p1_critical"} linked={majorIncident} canManage={canManageMi} />
            </Collapsible>
          )}

          {/* Vinculos: se ocultan cuando estan VACIOS para no ensuciar la pantalla; quien puede
              gestionar los sigue viendo (aunque vacios) para poder vincular. KB solo si hay match. */}
          {knowledge.length > 0 && (
            <Collapsible title={t("inc.section.knowledge")} tip="inc.tip.kb" count={knowledge.length} defaultOpen>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {knowledge.map((k) => (
                  <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--teal-soft)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--teal)" }}>{k.article_number}</span>
                    <span style={{ fontSize: 13, color: "var(--text)", flex: 1 }}>{k.title}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "var(--accent-2)" }}><Icon name="check" size={11} /> KB</span>
                  </div>
                ))}
              </div>
            </Collapsible>
          )}

          {(problems.length > 0 || canManageProblem) && (
            <Collapsible title={t("prob.linked")} tip="inc.tip.problem" count={problems.length} defaultOpen={problems.length > 0}>
              <ProblemLink incidentId={inc.id} problems={problems} canManage={canManageProblem} />
            </Collapsible>
          )}

          {(changes.length > 0 || canManageChange) && (
            <Collapsible title={t("chg.section.incident")} tip="inc.tip.changes" count={changes.length} defaultOpen={changes.length > 0}>
              <ChangeLink changes={changes} canManage={canManageChange} newHref={`/changes/new?incident=${inc.id}`} />
            </Collapsible>
          )}

          {(workflows.length > 0 || canRunWorkflow) && (
            <Collapsible title={t("wf.section.incident")} tip="inc.tip.workflows" count={workflows.length} defaultOpen={workflows.length > 0}>
              <IncidentWorkflows incidentId={inc.id} incidentTitle={inc.title} linked={workflows} definitions={workflowDefs} canRun={canRunWorkflow} />
            </Collapsible>
          )}

          {(financialCase || canManageFraud || canManageDispute) && (
            <Collapsible title={t("fc.section")} tip="inc.tip.financial" count={financialCase ? 1 : 0} defaultOpen={hasFinancial}>
              <FinancialCaseLink incidentId={inc.id} existing={financialCase} amount={inc.amount} canFraud={canManageFraud} canDispute={canManageDispute} />
            </Collapsible>
          )}

          {projects.length > 0 && (
            <Collapsible title={t("inc.section.projects")} count={projects.length} defaultOpen>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {projects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="cx-lift"
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: "var(--r-md)", background: "var(--paper)", textDecoration: "none" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{p.project_code}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    {p.squad?.name && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{p.squad.name}</span>}
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)" }}>{p.status}</span>
                  </Link>
                ))}
              </div>
            </Collapsible>
          )}

          {/* Transformacion / Evolucion / IA: solo Gerencia y roles con permiso (el operador ve la
              pantalla limpia; no se pierde el motor de scoring, §3.1 #2). */}
          {(canTriage || canManageAssign) && <EvaluatePanel incidentId={inc.id} />}
          {(canManageAssign || canManageProblem) && <EvolutionPanel incidentId={inc.id} status={inc.status} score={inc.transformation_score} candidate={inc.transformation_candidate} />}

          {(canTriage || canManageAssign) && (
            <AiSuggestions title={t("ai.opt.title")} hint={t("ai.opt.hint")} tip="inc.tip.ai">
              <Card title={t("inc.section.rca")}>
                <AiRca incidentId={inc.id} current={inc.root_cause_summary} />
              </Card>
              <Card title={t("ai2.title")}>
                <AiInsights incidentId={inc.id} canUpdate={canUpdateIncident} />
              </Card>
              <AiExecSummary incidentId={inc.id} />
              <Card title={t("inc.section.kb")}>
                <AiKb incidentId={inc.id} />
              </Card>
            </AiSuggestions>
          )}

          {/* Riesgo operativo (GRC): vinculo al evento de riesgo; se conserva como accion. */}
          {(riskEvent || canManageRisk) && (
            <Collapsible title={t("risk.title")} count={riskEvent ? 1 : 0} defaultOpen={!!riskEvent}>
              <RiskLink incidentId={inc.id} linked={riskEvent} canManage={canManageRisk} />
            </Collapsible>
          )}
        </div>
    </div>
  );
}

// Modulo plegable: encabezado con contador (vacio -> cerrado) para no ocupar pantalla. El header
// es un div clicable (no un <button>) para poder anidar el InfoTip (que es un boton) sin invalidar
// el HTML; el InfoTip detiene la propagacion para no plegar al abrirse.
function Collapsible({ title, tip, count, defaultOpen = false, children }: { title: string; tip?: MessageKey; count?: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => setOpen((o) => !o);
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
      <div role="button" tabIndex={0} aria-expanded={open} onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "15px 20px", cursor: "pointer" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</span>
        {tip && <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex" }}><InfoTip tip={tip} /></span>}
        <span style={{ flex: 1 }} />
        {count != null && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, minWidth: 22, textAlign: "center", padding: "1px 8px", borderRadius: "var(--r-pill)", background: count > 0 ? "var(--accent-soft)" : "var(--paper)", color: count > 0 ? "var(--accent-2)" : "var(--muted)" }}>{count}</span>}
        <Icon name={open ? "chevron-up" : "chevron-down"} size={16} color="var(--muted)" />
      </div>
      {open && <div style={{ padding: "0 20px 20px" }}>{children}</div>}
    </div>
  );
}

// Envuelve los paneles de IA/reglas en un plegable cerrado por defecto: la IA queda como
// sugerencia opcional, no como la vista principal del caso.
function AiSuggestions({ title, hint, tip, children }: { title: string; hint: string; tip?: MessageKey; children: React.ReactNode }) {
  return (
    <details style={{ background: "var(--card)", border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", padding: "4px 16px" }}>
      <summary style={{ cursor: "pointer", listStyle: "none", padding: "12px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="sparkle" size={14} color="var(--accent-bright)" />
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{title}</span>
        {tip && <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} style={{ display: "inline-flex" }}><InfoTip tip={tip} /></span>}
      </summary>
      <div style={{ fontSize: 11, color: "var(--muted)", paddingBottom: 6 }}>{hint}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 0 14px" }}>
        {children}
      </div>
    </details>
  );
}

function Card({ title, tip, children }: { title: string; tip?: MessageKey; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</span>
        {tip && <InfoTip tip={tip} />}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", textAlign: "right" }}>{value || "—"}</span>
    </div>
  );
}

