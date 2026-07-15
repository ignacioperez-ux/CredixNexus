"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ProjectRisk } from "@/lib/projects/queries";
import { addProjectRisk, setProjectRiskStatus, removeProjectRisk } from "@/lib/projects/actions";
import { Icon } from "@/components/ui/icon";

const KIND_COLOR: Record<string, string> = { blocker: "var(--st-critical-fg)", risk: "var(--st-high-fg)", dependency: "var(--st-eval)" };
const SEV_COLOR: Record<string, string> = { low: "var(--st-low)", medium: "var(--st-medium)", high: "var(--st-high)", critical: "var(--st-critical)" };
const NEXT_STATUS: Record<string, "open" | "mitigating" | "resolved"> = { open: "mitigating", mitigating: "resolved", resolved: "open" };
const KINDS = ["blocker", "risk", "dependency"] as const;
const SEVS = ["low", "medium", "high", "critical"] as const;

export function InitiativeRisks({ projectId, risks, squadOptions, canManage }: {
  projectId: string; risks: ProjectRisk[]; squadOptions: { id: string; name: string }[]; canManage: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "risk", title: "", severity: "medium", relatedSquadId: "" });
  const run = (fn: () => Promise<{ ok: boolean }>, after?: () => void) => start(async () => { const r = await fn(); if (r.ok) after?.(); router.refresh(); });

  const openRisks = risks.filter((r) => r.status !== "resolved");

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
          {t("irisk.title")} {openRisks.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--st-high-fg)" }}>· {openRisks.length}</span>}
        </span>
        {canManage && <button onClick={() => setOpen((o) => !o)} style={ghost}>{open ? <Icon name="x" size={12} /> : <Icon name="plus" size={12} />} {t("irisk.add")}</button>}
      </div>

      {canManage && open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, padding: 12, background: "var(--paper)", borderRadius: "var(--r-md)" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} style={sel}>{KINDS.map((k) => <option key={k} value={k}>{t(("irisk.kind." + k) as MessageKey)}</option>)}</select>
            <select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} style={sel}>{SEVS.map((s) => <option key={s} value={s}>{t(("irisk.sev." + s) as MessageKey)}</option>)}</select>
            {f.kind === "dependency" && (
              <select value={f.relatedSquadId} onChange={(e) => setF({ ...f, relatedSquadId: e.target.value })} style={sel}>
                <option value="">{t("irisk.dep.squad")}</option>
                {squadOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
          </div>
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t("irisk.title.ph")} style={inp} />
          <button onClick={() => { if (f.title.trim().length >= 3) run(() => addProjectRisk(projectId, { kind: f.kind, title: f.title, severity: f.severity, relatedSquadId: f.relatedSquadId || undefined }), () => { setF({ kind: "risk", title: "", severity: "medium", relatedSquadId: "" }); setOpen(false); }); }}
            disabled={pending || f.title.trim().length < 3} style={{ ...cta, alignSelf: "flex-start" }}>{t("irisk.save")}</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {risks.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("irisk.empty")}</div>}
        {risks.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 9, opacity: r.status === "resolved" ? 0.55 : 1 }}>
            <span title={t(("irisk.sev." + r.severity) as MessageKey)} style={{ width: 8, height: 8, borderRadius: "50%", background: SEV_COLOR[r.severity], flexShrink: 0 }} />
            <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3px", color: KIND_COLOR[r.kind], width: 62, flexShrink: 0 }}>{t(("irisk.kind." + r.kind) as MessageKey)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text)", textDecoration: r.status === "resolved" ? "line-through" : "none" }}>
              {r.title}{r.kind === "dependency" && r.related_squad ? <span style={{ color: "var(--muted)" }}> · {r.related_squad.name}</span> : ""}
            </span>
            <button onClick={() => canManage && run(() => setProjectRiskStatus(r.id, projectId, NEXT_STATUS[r.status]))} disabled={!canManage || pending}
              title={t("irisk.status.cycle")} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: "var(--r-pill)", border: "1px solid var(--line)", cursor: canManage ? "pointer" : "default", background: r.status === "resolved" ? "var(--st-low-bg)" : "var(--paper)", color: r.status === "resolved" ? "var(--st-low-fg)" : "var(--muted)", whiteSpace: "nowrap" }}>
              {t(("irisk.st." + r.status) as MessageKey)}
            </button>
            {canManage && <button onClick={() => run(() => removeProjectRisk(r.id, projectId))} disabled={pending} title={t("sq.remove")} style={{ border: "none", background: "transparent", color: "var(--st-critical-fg)", cursor: "pointer", padding: 2 }}><Icon name="x" size={12} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontFamily: "var(--font-ui)" };
const sel: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" };
const cta: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, padding: "8px 14px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer" };
const ghost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "6px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer" };
