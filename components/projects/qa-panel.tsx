"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ValidationRow } from "@/lib/projects/queries";
import { QA_NEXT, TEST_TYPES, ENVIRONMENTS, RESULTS, canAuthorizeProduction } from "@/lib/projects/qa-validation";
import { recordValidation, setQaStatus, authorizeProduction } from "@/lib/projects/qa-actions";
import { startWorkflow } from "@/lib/workflows/actions";

const QA_COLOR: Record<string, { fg: string; bg: string }> = {
  pending: { fg: "var(--muted)", bg: "var(--paper)" },
  in_testing: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  passed: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  failed: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
};
const RESULT_COLOR: Record<string, string> = { pass: "var(--st-low-fg)", fail: "var(--st-critical-fg)", blocked: "var(--st-high-fg)" };

type Wf = { id: string; instance_number: string; title: string; status: string; definition: { name: string } | null };
type Def = { id: string; code: string; name: string };

export function QaPanel({ projectId, projectName, qaStatus, prodAuthorizedAt, validations, canValidate, canDeploy, workflows, workflowDefs, canRunWorkflow }: {
  projectId: string; projectName: string; qaStatus: string; prodAuthorizedAt: string | null; validations: ValidationRow[];
  canValidate: boolean; canDeploy: boolean; workflows: Wf[]; workflowDefs: Def[]; canRunWorkflow: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [run, setRun] = useState({ name: "", testType: "regression", environment: "test", result: "pass", evidenceUrl: "" });
  const [authNotes, setAuthNotes] = useState("");
  const [pickDef, setPickDef] = useState("");
  const qc = QA_COLOR[qaStatus] ?? QA_COLOR.pending;

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setMsg(null);
    start(async () => { const r = await fn(); if (!r.ok) setMsg(r.error ?? "error"); else { after?.(); router.refresh(); } });
  }
  function begin() { if (!pickDef) return; start(async () => { const r = await startWorkflow(pickDef, "project", projectId, projectName); if (r.ok) router.push(`/workflows/${r.id}`); else setMsg(r.error ?? "error"); }); }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("qa.title")}</span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: qc.fg, background: qc.bg, padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t(("qa.st." + qaStatus) as MessageKey)}</span>
        {prodAuthorizedAt && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--st-low-fg)", background: "var(--st-low-bg)", padding: "3px 10px", borderRadius: "var(--r-pill)" }}>✓ {t("qa.authorized")}</span>}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{t("qa.intro")}</p>
      {msg && <div style={{ fontSize: 12, color: "var(--st-critical)" }}>{errMsg(msg, t)}</div>}

      {/* Pipeline de Evolucion (workflow) */}
      <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", marginBottom: 8 }}>{t("qa.pipeline")}</div>
        {workflows.length === 0 ? (
          canRunWorkflow && workflowDefs.length > 0 ? (
            <div style={{ display: "flex", gap: 8 }}>
              <select value={pickDef} onChange={(e) => setPickDef(e.target.value)} style={{ ...inp, flex: 1 }}>
                <option value="">{t("wf.link.pick")}</option>
                {workflowDefs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button onClick={begin} disabled={pending || !pickDef} style={btnPrimary}>{t("wf.start")}</button>
            </div>
          ) : <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("wf.link.none")}</div>
        ) : (
          workflows.map((w) => (
            <Link key={w.id} href={`/workflows/${w.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--paper)", textDecoration: "none", marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)" }}>{w.instance_number}</span>
              <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1 }}>{w.definition?.name ?? w.title}</span>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{w.status}</span>
            </Link>
          ))
        )}
      </div>

      {/* Estado de calidad */}
      {canValidate && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("qa.setstatus")}:</span>
          {(QA_NEXT[qaStatus] ?? []).map((s) => (
            <button key={s} onClick={() => act(() => setQaStatus(projectId, s))} disabled={pending} style={btnGhost}>→ {t(("qa.st." + s) as MessageKey)}</button>
          ))}
        </div>
      )}

      {/* Bateria de pruebas */}
      <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", marginBottom: 8 }}>{t("qa.battery")} ({validations.length})</div>
        {canValidate && (
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 10, alignItems: "center" }}>
            <input value={run.name} onChange={(e) => setRun({ ...run, name: e.target.value })} placeholder={t("qa.run.name")} style={inp} />
            <select value={run.testType} onChange={(e) => setRun({ ...run, testType: e.target.value })} style={inp}>{TEST_TYPES.map((x) => <option key={x} value={x}>{t(("qa.tt." + x) as MessageKey)}</option>)}</select>
            <select value={run.environment} onChange={(e) => setRun({ ...run, environment: e.target.value })} style={inp}>{ENVIRONMENTS.map((x) => <option key={x} value={x}>{t(("qa.env." + x) as MessageKey)}</option>)}</select>
            <select value={run.result} onChange={(e) => setRun({ ...run, result: e.target.value })} style={inp}>{RESULTS.map((x) => <option key={x} value={x}>{t(("qa.res." + x) as MessageKey)}</option>)}</select>
            <button onClick={() => act(() => recordValidation(projectId, run), () => setRun({ ...run, name: "", evidenceUrl: "" }))} disabled={pending || !run.name} style={btnPrimary}>+ {t("qa.run.add")}</button>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {validations.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("qa.battery.empty")}</div>}
          {validations.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: "var(--r-md)", background: "var(--paper)" }}>
              <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1 }}>{v.name}</span>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{t(("qa.tt." + v.test_type) as MessageKey)} · {t(("qa.env." + v.environment) as MessageKey)}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: RESULT_COLOR[v.result] ?? "var(--muted)" }}>{t(("qa.res." + v.result) as MessageKey)}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{new Date(v.run_at).toLocaleDateString(locale)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Autorizacion a produccion */}
      <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
        {prodAuthorizedAt ? (
          <div style={{ fontSize: 12.5, color: "var(--st-low-fg)", fontWeight: 600 }}>✓ {t("qa.authorized.at")} {new Date(prodAuthorizedAt).toLocaleString(locale)}</div>
        ) : canDeploy ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11.5, color: canAuthorizeProduction(qaStatus) ? "var(--muted)" : "var(--st-high-fg)" }}>
              {canAuthorizeProduction(qaStatus) ? t("qa.auth.ready") : t("qa.auth.blocked")}
            </div>
            <input value={authNotes} onChange={(e) => setAuthNotes(e.target.value)} placeholder={t("qa.auth.notes")} style={inp} />
            <button onClick={() => act(() => authorizeProduction(projectId, authNotes))} disabled={pending || !canAuthorizeProduction(qaStatus)}
              style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 700, padding: "9px 18px", borderRadius: "var(--r-md)", border: "none", cursor: pending || !canAuthorizeProduction(qaStatus) ? "default" : "pointer", background: canAuthorizeProduction(qaStatus) ? "var(--cta-bg)" : "var(--paper)", color: canAuthorizeProduction(qaStatus) ? "var(--cta-fg)" : "var(--muted)" }}>
              {t("qa.auth.confirm")}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("qa.auth.pendingother")}</div>
        )}
      </div>
    </div>
  );
}

function errMsg(e: string, t: (k: MessageKey) => string): string {
  if (e === "qa_not_passed") return t("qa.err.notpassed");
  if (e === "already_authorized") return t("qa.err.already");
  return e;
}
const inp: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)", width: "100%" };
const btnPrimary: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer", whiteSpace: "nowrap" };
const btnGhost: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
