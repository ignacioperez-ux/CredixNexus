"use client";

import { Icon } from "@/components/ui/icon";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { addProjectTask, setTaskStatus, changeProjectStatus, softDeleteProject } from "@/lib/projects/actions";
import { computeRoi } from "@/lib/projects/queries";
import { AiBusinessCase } from "./ai-business-case";
import { BackButton } from "@/components/common/back-button";
import { QaPanel } from "./qa-panel";
import { ProjectStepper } from "./project-stepper";

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
};
type Task = { id: string; title: string; status: string; priority: string; due_date: string | null; completed_at: string | null };
type ValidationRow = { id: string; name: string; test_type: string; environment: string; result: string; evidence_url: string | null; notes: string | null; run_at: string };
type Wf = { id: string; instance_number: string; title: string; status: string; definition: { name: string } | null };
type Def = { id: string; code: string; name: string };

const TASK_STATES = ["todo", "doing", "blocked", "done"];

export function ProjectDetail({ project, tasks, validations = [], workflows = [], workflowDefs = [], qa = { canValidate: false, canDeploy: false, canRunWorkflow: false } }: {
  project: ProjectDetailData; tasks: Task[]; validations?: ValidationRow[]; workflows?: Wf[]; workflowDefs?: Def[];
  qa?: { canValidate: boolean; canDeploy: boolean; canRunWorkflow: boolean };
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [newTask, setNewTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [taskErr, setTaskErr] = useState<string | null>(null);

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
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {project.status !== "active" && <button onClick={() => setStatus("active")} disabled={busy} style={ghost}><Icon name="play" size={12} fill="currentColor" style={{ verticalAlign: "-1px" }} /> {t("pst.active")}</button>}
          {project.status !== "completed" && <button onClick={() => setStatus("completed")} disabled={busy} style={ghost}><Icon name="check" size={13} style={{ verticalAlign: "-2px" }} /> {t("pst.completed")}</button>}
          <Link href={`/projects/${project.id}/edit`} style={{ ...ghost, textDecoration: "none" }}><Icon name="edit" size={13} style={{ verticalAlign: "-2px" }} /> {t("proj.save")}</Link>
          <button onClick={remove} disabled={busy} style={cancelBtn}>{t("proj.cancel")}</button>
        </div>
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
                  <button onClick={() => cycle(tk.id, tk.status)} title="cambiar estado"
                    style={{ padding: "3px 9px", borderRadius: "var(--r-pill)", fontSize: 10.5, fontWeight: 600, border: "1px solid var(--line)", cursor: "pointer",
                      background: tk.status === "done" ? "var(--st-low-bg)" : "var(--paper)", color: tk.status === "done" ? "var(--st-low-fg)" : "var(--muted)" }}>
                    {t(("tsk." + tk.status) as MessageKey)}
                  </button>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text)", textDecoration: tk.status === "done" ? "line-through" : "none", opacity: tk.status === "done" ? 0.6 : 1 }}>{tk.title}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder={t("proj.task.title")}
                style={{ flex: 1, padding: "9px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13 }} />
              <button onClick={add} style={{ padding: "9px 16px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{t("proj.task.add")}</button>
            </div>
            {taskErr && <p style={{ color: "var(--st-critical-fg)", fontSize: 11, marginTop: 6 }}>{taskErr}</p>}
          </Card>

          <Card title={t("proj.section.aibc")}>
            <AiBusinessCase projectId={project.id} current={project.business_case?.narrative ?? null} />
          </Card>

          {project.incident && (
            <Card title={t("proj.section.origin")}>
              <Link href={`/incidents/${project.incident.id}`} style={{ textDecoration: "none" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-2)" }}>{project.incident.incident_number}</span>
                <span style={{ fontSize: 13, color: "var(--text)", marginLeft: 10 }}>{project.incident.title}</span>
              </Link>
            </Card>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--dark-surface)", border: "1px solid var(--dark-surface-border)", borderRadius: "var(--r-xl)", padding: 18, color: "var(--dark-surface-fg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>{t("proj.wsjf")}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 500, color: "var(--accent-bright)" }}>{Number(project.wsjf).toFixed(1)}</span>
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 8, fontFamily: "var(--font-mono)" }}>
              ({project.business_value}+{project.time_criticality}+{project.risk_reduction}) / {project.job_size}
            </div>
          </div>

          <Card title={t("proj.field.squad")}>
            <Row label={t("area.field")} value={project.area?.name} />
            <Row label={t("proj.field.squad")} value={project.squad?.name} />
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
const ghost: React.CSSProperties = { padding: "7px 12px", borderRadius: "var(--r-md)", background: "var(--card)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
// Accion destructiva de-enfatizada: no es un paso del flujo (setea Cancelado, no elimina).
const cancelBtn: React.CSSProperties = { padding: "7px 10px", borderRadius: "var(--r-md)", background: "transparent", border: "none", color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textDecorationColor: "var(--line)", textUnderlineOffset: 3 };
