"use client";

import { Icon } from "@/components/ui/icon";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { addProjectTask, setTaskStatus, changeProjectStatus, softDeleteProject } from "@/lib/projects/actions";
import { computeRoi, type AnchorCase, type InitiativeSquad, type ProjectRisk } from "@/lib/projects/queries";
import { statusKey, statusColors } from "@/lib/incidents/labels";
import { initiativeHealth, openRiskCount } from "@/lib/projects/health";
import { InitiativeSquads } from "./initiative-squads";
import { InitiativeRisks } from "./initiative-risks";
import { AiBusinessCase } from "./ai-business-case";
import { BackButton } from "@/components/common/back-button";
import { QaPanel } from "./qa-panel";
import { ProjectStepper } from "./project-stepper";
import { EvaluateMemberPanel } from "@/components/talent/evaluate-member-panel";

type Named = { name: string } | null;
export type ProjectDetailData = {
  id: string;
  project_code: string;
  name: string;
  description: string | null;
  status: string;
  wsjf: number;
  business_value: number;
  time_criticality: number;
  risk_reduction: number;
  job_size: number;
  estimated_benefit_amount: number;
  estimated_cost_amount: number;
  business_case: { narrative?: string } | null;
  squad: ({ name: string; is_transversal: boolean }) | null;
  business_unit: Named;
  area: ({ name: string } | null);
  incident: ({ id: string; incident_number: string; title: string; status: string }) | null;
  qa_status: string;
  prod_authorized_at: string | null;
  initiative_type?: string | null;
};
type Task = { id: string; title: string; status: string; priority: string; due_date: string | null; completed_at: string | null };
type ValidationRow = { id: string; name: string; test_type: string; environment: string; result: string; evidence_url: string | null; notes: string | null; run_at: string };
type Wf = { id: string; instance_number: string; title: string; status: string; definition: { name: string } | null };
type Def = { id: string; code: string; name: string };

const TASK_STATES = ["todo", "doing", "blocked", "done"];

export function ProjectDetail({ project, tasks, validations = [], workflows = [], workflowDefs = [], qa = { canValidate: false, canDeploy: false, canRunWorkflow: false }, squadMembers = [], canManageTalent = false, canManage = false, canReadIncident = false, anchor = null, initiativeSquads = [], squadOptions = [], risks = [] }: {
  project: ProjectDetailData; tasks: Task[]; validations?: ValidationRow[]; workflows?: Wf[]; workflowDefs?: Def[];
  qa?: { canValidate: boolean; canDeploy: boolean; canRunWorkflow: boolean };
  squadMembers?: { id: string; name: string }[]; canManageTalent?: boolean;
  canManage?: boolean; canReadIncident?: boolean; anchor?: AnchorCase | null;
  initiativeSquads?: InitiativeSquad[]; squadOptions?: { id: string; name: string }[]; risks?: ProjectRisk[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [newTask, setNewTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [taskErr, setTaskErr] = useState<string | null>(null);
  const health = initiativeHealth(risks);
  const openRisks = openRiskCount(risks);
  const healthColor = health === "crit" ? "var(--st-critical-fg)" : health === "warn" ? "var(--st-high-fg)" : "var(--st-low-fg)";
  const healthBg = health === "crit" ? "var(--st-critical-bg)" : health === "warn" ? "var(--st-high-bg)" : "var(--st-low-bg)";

  async function add() {
    setTaskErr(null);
    const res = await addProjectTask(project.id, newTask);
    if (!res.ok) { setTaskErr(t("err.ERR_MIN_LENGTH")); return; }
    setNewTask("");
    router.refresh();
  }
  async function cycle(taskId: string, current: string) {
    const next = TASK_STATES[(TASK_STATES.indexOf(current) + 1) % TASK_STATES.length];
    await setTaskStatus(taskId, project.id, next);
    router.refresh();
  }
  async function setStatus(s: string) { setBusy(true); await changeProjectStatus(project.id, s); setBusy(false); router.refresh(); }
  async function remove() {
    if (!confirm(t("proj.cancel.confirm"))) return;
    setBusy(true); await softDeleteProject(project.id); setBusy(false);
    router.push("/projects"); router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/projects" />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-2)" }}>{project.project_code}</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, margin: 0, color: "var(--text)" }}>{project.name}</h1>
          <ProjectStepper status={project.status} />
          {project.initiative_type && (
            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--accent-2)", background: "var(--accent-soft)", padding: "3px 9px", borderRadius: "var(--r-pill)" }}>
              {t(("init.type." + project.initiative_type) as MessageKey)}
            </span>
          )}
          <span title={t(("irisk.health." + health) as MessageKey)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: healthColor, background: healthBg, padding: "3px 9px", borderRadius: "var(--r-pill)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: healthColor }} />
            {t(("irisk.health." + health) as MessageKey)}{openRisks > 0 ? ` · ${openRisks}` : ""}
          </span>
        </div>
        {canManage && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {project.status !== "active" && <button onClick={() => setStatus("active")} disabled={busy} style={ghost}><Icon name="play" size={12} fill="currentColor" style={{ verticalAlign: "-1px" }} /> {t("pst.active")}</button>}
            {project.status !== "completed" && <button onClick={() => setStatus("completed")} disabled={busy} style={ghost}><Icon name="check" size={13} style={{ verticalAlign: "-2px" }} /> {t("pst.completed")}</button>}
            <Link href={`/projects/${project.id}/edit`} style={{ ...ghost, textDecoration: "none" }}><Icon name="edit" size={13} style={{ verticalAlign: "-2px" }} /> {t("proj.save")}</Link>
            <button onClick={remove} disabled={busy} style={cancelBtn}>{t("proj.cancel")}</button>
          </div>
        )}
      </div>

      <QaPanel projectId={project.id} projectName={project.name} qaStatus={project.qa_status} prodAuthorizedAt={project.prod_authorized_at}
        validations={validations} canValidate={qa.canValidate} canDeploy={qa.canDeploy}
        workflows={workflows} workflowDefs={workflowDefs} canRunWorkflow={qa.canRunWorkflow} />

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {project.description && <Card title={t("proj.field.description")}><p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text)" }}>{project.description}</p></Card>}

          <Card title={t("proj.section.tasks")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {tasks.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("proj.tasks.empty")}</div>}
              {tasks.map((tk) => (
                <div key={tk.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <button onClick={canManage ? () => cycle(tk.id, tk.status) : undefined} disabled={!canManage} title={canManage ? "cambiar estado" : undefined}
                    style={{ padding: "3px 9px", borderRadius: "var(--r-pill)", fontSize: 10.5, fontWeight: 600, border: "1px solid var(--line)", cursor: canManage ? "pointer" : "default",
                      background: tk.status === "done" ? "var(--st-low-bg)" : "var(--paper)", color: tk.status === "done" ? "var(--st-low-fg)" : "var(--muted)" }}>
                    {t(("tsk." + tk.status) as MessageKey)}
                  </button>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text)", textDecoration: tk.status === "done" ? "line-through" : "none", opacity: tk.status === "done" ? 0.6 : 1 }}>{tk.title}</span>
                </div>
              ))}
            </div>
            {canManage && (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder={t("proj.task.title")}
                  style={{ flex: 1, padding: "9px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13 }} />
                <button onClick={add} style={{ padding: "9px 16px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{t("proj.task.add")}</button>
              </div>
            )}
            {taskErr && <p style={{ color: "var(--st-critical-fg)", fontSize: 11, marginTop: 6 }}>{taskErr}</p>}
          </Card>

          <Card title={t("proj.section.aibc")}>
            <AiBusinessCase projectId={project.id} current={project.business_case?.narrative ?? null} />
          </Card>

          <InitiativeRisks projectId={project.id} risks={risks} squadOptions={squadOptions} canManage={canManage} />

          {project.incident && (
            <Card title={t("proj.section.origin")}>
              {/* §0: la incidencia es el ANCLA. La mesa conserva el tracking y la comunicacion con el
                  cliente de extremo a extremo. El Gerente de Evolucion ve el caso en SOLO LECTURA
                  (no gestiona incidencias); el deep-link solo aparece si tiene incident.read. */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: anchor ? 12 : 0 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)" }}>{project.incident.incident_number}</span>
                <span style={{ fontSize: 13, color: "var(--text)", flex: 1, minWidth: 140 }}>{project.incident.title}</span>
                {anchor && <StatusPill status={anchor.status} label={t(statusKey(anchor.status))} />}
                {canReadIncident && <Link href={`/incidents/${project.incident.id}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-2)", textDecoration: "none", whiteSpace: "nowrap" }}>{t("proj.origin.open")} →</Link>}
              </div>

              {anchor && (
                <>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 11.5, color: "var(--muted)", marginBottom: anchor.comments.length ? 12 : 0 }}>
                    {anchor.opened_at && <span>{t("proj.origin.opened")}: <b style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{fmtDate(anchor.opened_at, locale)}</b></span>}
                    {anchor.resolved_at && <span>{t("proj.origin.resolved")}: <b style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{fmtDate(anchor.resolved_at, locale)}</b></span>}
                  </div>

                  {anchor.comments.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", marginBottom: 8 }}>{t("proj.origin.thread")}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                        {anchor.comments.map((c) => (
                          <div key={c.id} style={{ padding: "8px 11px", background: "var(--paper)", border: "1px solid var(--line-soft, var(--line))", borderRadius: 9 }}>
                            <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.body}</div>
                            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                              {c.is_system_generated ? `${t("proj.origin.system")} · ` : ""}{fmtDate(c.created_at, locale)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {project.status === "completed" && squadMembers.length > 0 && canManageTalent && (
            <EvaluateMemberPanel members={squadMembers} entityType="project" entityId={project.id} title={t("eval.title.project")} />
          )}
          <div style={{ background: "var(--dark-surface)", border: "1px solid var(--dark-surface-border)", borderRadius: "var(--r-xl)", padding: 18, color: "var(--dark-surface-fg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>{t("proj.wsjf")}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 500, color: "var(--accent-bright)" }}>{Number(project.wsjf).toFixed(1)}</span>
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 8, fontFamily: "var(--font-mono)" }}>
              ({project.business_value}+{project.time_criticality}+{project.risk_reduction}) / {project.job_size}
            </div>
          </div>

          <InitiativeSquads projectId={project.id} squads={initiativeSquads} options={squadOptions} canManage={canManage} />

          <Card title={t("proj.field.squad")}>
            <Row label={t("area.field")} value={project.area?.name} />
            <Row label={t("proj.field.bu")} value={project.business_unit?.name} />
          </Card>

          <Card title={t("proj.section.business")}>
            <Row label={t("proj.field.benefit")} value={fmt(project.estimated_benefit_amount, locale)} mono />
            <Row label={t("proj.field.cost")} value={fmt(project.estimated_cost_amount, locale)} mono />
            <Row label={t("proj.roi")} value={(() => { const r = computeRoi(project.estimated_benefit_amount, project.estimated_cost_amount); return r != null ? `${r}%` : "—"; })()} mono />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14, color: "var(--text)" }}>{title}</div>{children}</div>;
}
function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
    <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
    <span style={{ fontSize: 12.5, color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)" }}>{value || "—"}</span></div>;
}
function fmt(v: number, locale: string) {
  return new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(v ?? 0);
}
function fmtDate(v: string, locale: string) {
  return new Date(v).toLocaleDateString(locale === "es" ? "es-CR" : "en-US", { day: "2-digit", month: "short", year: "numeric" });
}
function StatusPill({ status, label }: { status: string; label: string }) {
  const c = statusColors(status);
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: "var(--r-pill)", background: c.bg, color: c.fg, whiteSpace: "nowrap" }}>{label}</span>;
}
const ghost: React.CSSProperties = { padding: "7px 12px", borderRadius: "var(--r-md)", background: "var(--card)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
// Accion destructiva de-enfatizada: no es un paso del flujo (setea Cancelado, no elimina).
const cancelBtn: React.CSSProperties = { padding: "7px 10px", borderRadius: "var(--r-md)", background: "transparent", border: "none", color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textDecorationColor: "var(--line)", textUnderlineOffset: 3 };
