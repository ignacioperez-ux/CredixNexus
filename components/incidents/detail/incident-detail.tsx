"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { PriorityTag } from "../badges";
import { CommentThread } from "./comment-thread";
import { StatusActions } from "./status-actions";
import { StatusStepper } from "./status-stepper";
import { AssignResponsible } from "./assign-responsible";
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
import { IncidentWorkflows } from "@/components/workflows/incident-workflows";
import { ChangeLink } from "@/components/changes/change-link";
import { DeclareMi } from "@/components/major-incidents/declare-mi";
import { FinancialCaseLink, type FinancialCase } from "@/components/fraud/financial-case-link";
import { Icon } from "@/components/ui/icon";
import type { IncidentProject } from "@/lib/projects/queries";
import { Attachments } from "./attachments";
import { CaseTasks } from "./case-tasks";
import type { Attachment, ChecklistData } from "@/lib/casework/queries";

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

export function IncidentDetail({ inc, comments, ledger, knowledge = [], riskEvent = null, canManageRisk = false, problems = [], canManageProblem = false, projects = [], escalations = [], workflows = [], workflowDefs = [], canRunWorkflow = false, changes = [], canManageChange = false, majorIncident = null, canManageMi = false, vendor = null, canUpdateIncident = false, canTriage = false, effort, canLogWork = false, survey = null, canSubmitCsat = false, financialCase = null, canManageFraud = false, canManageDispute = false, attachments = [], tasks, members = [], canManageTalent = false }: { inc: IncidentDetailData; comments: Comment[]; ledger: LedgerRow[]; knowledge?: Kb[]; riskEvent?: RiskLinked; canManageRisk?: boolean; problems?: ProblemLinked[]; canManageProblem?: boolean; projects?: IncidentProject[]; escalations?: EscalationView[]; workflows?: WfLinked[]; workflowDefs?: WfDef[]; canRunWorkflow?: boolean; changes?: ChangeLinked[]; canManageChange?: boolean; majorIncident?: MiLinked; canManageMi?: boolean; vendor?: VendorChip; canUpdateIncident?: boolean; canTriage?: boolean; effort?: IncidentEffort; canLogWork?: boolean; survey?: CsatSurvey | null; canSubmitCsat?: boolean; financialCase?: FinancialCase; canManageFraud?: boolean; canManageDispute?: boolean; attachments?: Attachment[]; tasks?: ChecklistData; members?: AssignableMember[]; canManageTalent?: boolean }) {
  const { t, locale } = useI18n();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/incidents" />

      {/* Admision: si el caso aun no fue triado, primero se valida (admitir/descartar) */}
      {inc.intake_status === "pending" && canTriage && (
        <TriagePanel incidentId={inc.id} knowledge={knowledge} />
      )}

      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-2)" }}>{inc.incident_number}</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.3px", margin: 0, color: "var(--text)" }}>{inc.title}</h1>
          <StatusStepper status={inc.status} />
          <PriorityTag priority={inc.priority} />
          {inc.intake_status === "pending" && <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "var(--accent-2)", background: "var(--accent-soft)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t("tri.pending")}</span>}
          {inc.intake_status === "discarded" && <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", background: "var(--paper)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t("tri.discarded")}</span>}
          {inc.classified_as && inc.intake_status === "accepted" && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--st-info)", background: "var(--st-info-bg)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t(("tri.class." + inc.classified_as) as MessageKey)}</span>}
        </div>
        {(canUpdateIncident || canTriage) && <StatusActions incidentId={inc.id} status={inc.status} />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        {/* Columna principal */}
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

          <Card title={t("inc.section.knowledge")}>
            {knowledge.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("inc.kb.none")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {knowledge.map((k) => (
                  <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--teal-soft)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--teal)" }}>{k.article_number}</span>
                    <span style={{ fontSize: 13, color: "var(--text)", flex: 1 }}>{k.title}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "var(--accent-2)" }}><Icon name="check" size={11} /> KB</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title={t("prob.linked")}>
            <ProblemLink incidentId={inc.id} problems={problems} canManage={canManageProblem} />
          </Card>

          <Card title={t("wf.section.incident")}>
            <IncidentWorkflows incidentId={inc.id} incidentTitle={inc.title} linked={workflows} definitions={workflowDefs} canRun={canRunWorkflow} />
          </Card>

          <Card title={t("chg.section.incident")}>
            <ChangeLink changes={changes} canManage={canManageChange} newHref={`/changes/new?incident=${inc.id}`} />
          </Card>

          {/* Proyectos de Evolucion nacidos de este incidente: el ancla conserva el hilo (§0) */}
          {projects.length > 0 && (
            <Card title={t("inc.section.projects")}>
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
            </Card>
          )}

          {(financialCase || canManageFraud || canManageDispute) && (
            <Card title={t("fc.section")}>
              <FinancialCaseLink incidentId={inc.id} existing={financialCase} amount={inc.amount} canFraud={canManageFraud} canDispute={canManageDispute} />
            </Card>
          )}

          <Card title={`${t("task.section")}${tasks && tasks.tasks.length > 0 ? ` (${tasks.done}/${tasks.open + tasks.done})` : ""}`}>
            <CaseTasks incidentId={inc.id} data={tasks ?? { tasks: [], open: 0, done: 0, progress: null }} canManage={canUpdateIncident} />
          </Card>

          <Card title={`${t("att.section")}${attachments.length > 0 ? ` (${attachments.length})` : ""}`}>
            <Attachments incidentId={inc.id} attachments={attachments} canManage={canUpdateIncident} />
          </Card>

          <Card title={t("inc.section.timeline")}>
            <CommentThread incidentId={inc.id} comments={comments} />
          </Card>

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

        {/* Aside */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(majorIncident || inc.priority === "p1_critical" || canManageMi) && (
            <Card title={t("mi.section.incident")}>
              <DeclareMi incidentId={inc.id} incidentTitle={inc.title} isP1={inc.priority === "p1_critical"} linked={majorIncident} canManage={canManageMi} />
            </Card>
          )}
          <AssignResponsible incidentId={inc.id} members={members} currentName={inc.assignee?.name ?? null} canAssign={canUpdateIncident} />
          {(inc.status === "resolved" || inc.status === "closed") && inc.assigned_member_id && inc.assignee && canManageTalent && (
            <EvaluateMemberPanel members={[{ id: inc.assigned_member_id, name: inc.assignee.name }]} entityType="incident" entityId={inc.id} title={t("eval.title.incident")} />
          )}
          <EvaluatePanel incidentId={inc.id} />
          {(canUpdateIncident || canManageProblem) && <EvolutionPanel incidentId={inc.id} status={inc.status} score={inc.transformation_score} candidate={inc.transformation_candidate} />}
          <AiSuggestions title={t("ai.opt.title")} hint={t("ai.opt.hint")}>
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

          <Card title="SLA">
            <SlaBar label={t("inc.sla.response")} dueAt={inc.sla_response_due_at} openedAt={inc.opened_at} resolvedAt={inc.resolved_at} status={inc.status} locale={locale} />
            <SlaBar label={t("inc.sla.resolution")} dueAt={inc.sla_resolution_due_at} openedAt={inc.opened_at} resolvedAt={inc.resolved_at} status={inc.status} locale={locale} last />
          </Card>

          <Card title={t("sla.section.escalations")}>
            <IncidentEscalations escalations={escalations} />
          </Card>

          {effort && (
            <Card title={t("wl2.title")}>
              <WorkLog incidentId={inc.id} effort={effort} canLog={canLogWork} />
            </Card>
          )}

          {(survey || inc.status === "resolved" || inc.status === "closed") && (
            <Card title={t("csat.title")}>
              <CsatPanel incidentId={inc.id} survey={survey} canSubmit={canSubmitCsat} />
            </Card>
          )}

          <Card title={t("inc.section.classification")}>
            <Row label={t("area.field")} value={inc.area?.name} />
            <Row label={t("inc.field.category")} value={inc.category?.name} />
            <Row label={t("inc.team")} value={inc.category?.default_team} />
            <Row label="RCA" value={inc.category?.requires_rca ? "Sí" : "No"} />
            <Row label="KB" value={inc.category?.requires_kb ? "Sí" : "No"} />
          </Card>

          <Card title={t("inc.section.fintech")}>
            <Row label={t("inc.f.casetype")} value={inc.case_type} />
            <Row label={t("inc.f.amount")} value={inc.amount != null ? new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: inc.currency || "CRC", maximumFractionDigits: 0 }).format(inc.amount) : null} mono />
            <Row label={t("inc.f.txn")} value={inc.transaction_reference} mono />
            <Row label={t("inc.f.customer")} value={inc.customer_name ? (inc.pii_flag ? maskName(inc.customer_name) : inc.customer_name) : null} />
            {inc.affected_party_id && (
              <div style={{ padding: "6px 0" }}>
                <Link href={`/customers/${inc.affected_party_id}`} style={{ fontSize: 12, color: "var(--accent-2)", textDecoration: "none", fontWeight: 600 }}>→ {t("cust.link")}</Link>
              </div>
            )}
            <Row label={t("inc.f.risk")} value={inc.risk_score != null ? String(Math.round(inc.risk_score)) : null} mono />
            <Row label={t("inc.f.sensitive")} value={inc.sensitive_flag ? "Sí" : "No"} />
            <Row label={t("inc.f.pii")} value={inc.pii_flag ? "Sí" : "No"} />
            <RiskLink incidentId={inc.id} linked={riskEvent} canManage={canManageRisk} />
          </Card>

          <Card title={t("inc.section.impact")}>
            <Row label={t("inc.field.financial")} value={formatCurrency(inc.financial_impact_estimate, locale)} mono />
            <Row label="Transacciones" value={String(inc.affected_transaction_count)} mono />
            <Row label="Partner" value={inc.partner_impact ? "Sí" : "No"} />
          </Card>
        </div>
      </div>
    </div>
  );
}

// Envuelve los paneles de IA/reglas en un plegable cerrado por defecto: la IA queda como
// sugerencia opcional, no como la vista principal del caso.
function AiSuggestions({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <details style={{ background: "var(--card)", border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", padding: "4px 16px" }}>
      <summary style={{ cursor: "pointer", listStyle: "none", padding: "12px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="sparkle" size={14} color="var(--accent-bright)" />
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{title}</span>
      </summary>
      <div style={{ fontSize: 11, color: "var(--muted)", paddingBottom: 6 }}>{hint}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 0 14px" }}>
        {children}
      </div>
    </details>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14, color: "var(--text)" }}>{title}</div>
      {children}
    </div>
  );
}

/** Barra de progreso de SLA: elapsed vs objetivo, con umbrales 75/90 y color semantico.
 *  Si el caso esta resuelto/cerrado/en evolucion, se congela y marca cumplido. */
function SlaBar({ label, dueAt, openedAt, resolvedAt, status, locale, last }: {
  label: string; dueAt: string | null; openedAt: string; resolvedAt: string | null; status: string; locale: string; last?: boolean;
}) {
  const border = last ? {} : { borderBottom: "1px solid var(--line-soft)" };
  if (!dueAt) {
    return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", ...border }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span><span style={{ fontSize: 12.5, color: "var(--muted)" }}>—</span></div>;
  }
  const start = new Date(openedAt).getTime();
  const due = new Date(dueAt).getTime();
  const settled = !!resolvedAt || status === "resolved" || status === "closed" || status === "in_evolution";
  const now = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const pct = due > start ? ((now - start) / (due - start)) * 100 : (now >= due ? 100 : 0);
  const clamped = Math.max(2, Math.min(100, pct));
  const breached = !settled && pct >= 100;
  const color = breached ? "var(--st-critical)" : settled ? "var(--st-low)" : pct >= 90 ? "var(--st-high)" : pct >= 75 ? "var(--st-medium)" : "var(--st-low)";
  return (
    <div style={{ padding: "9px 0", ...border }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <span style={{ color: "var(--muted)" }}>{label}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)", color, fontWeight: 600 }}>
          {settled ? <><Icon name="check" size={12} /> {Math.round(Math.min(100, pct))}%</> : `${Math.round(pct)}%`}
        </span>
      </div>
      <div style={{ position: "relative", height: 7, borderRadius: 20, background: "var(--track)", overflow: "hidden", marginTop: 7 }}>
        <div style={{ width: `${clamped}%`, height: "100%", background: color, borderRadius: 20 }} />
        {/* umbrales 75 / 90 */}
        <span style={{ position: "absolute", left: "75%", top: 0, bottom: 0, width: 1.5, background: "var(--card)", opacity: .8 }} />
        <span style={{ position: "absolute", left: "90%", top: 0, bottom: 0, width: 1.5, background: "var(--card)", opacity: .8 }} />
      </div>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 5, fontFamily: "var(--font-mono)" }}>{new Date(dueAt).toLocaleString(locale)}</div>
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

function formatCurrency(v: number, locale: string): string {
  return new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(v ?? 0);
}

/** Enmascara PII: "Juan Perez" -> "J••• P•••" (§3.4 no exponer PII). */
function maskName(name: string): string {
  return name.split(/\s+/).map((p) => (p ? p[0] + "•••" : "")).join(" ");
}
