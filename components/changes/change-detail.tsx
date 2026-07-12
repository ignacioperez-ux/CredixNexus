"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { CHANGE_NEXT } from "@/lib/changes/validation";
import { changeStatus, cabDecision } from "@/lib/changes/actions";
import { ChangeStatusBadge, RiskBadge } from "./badges";
import { BackButton } from "@/components/common/back-button";

type ChangeView = {
  id: string; change_number: string; title: string; description: string | null;
  change_type: string; risk_level: string; status: string;
  justification: string | null; implementation_plan: string | null; rollback_plan: string | null;
  planned_start: string | null; planned_end: string | null; actual_start: string | null; actual_end: string | null;
  cab_decision: string | null; cab_decision_at: string | null; cab_notes: string | null;
  ci: { name: string } | null; service: { name: string } | null;
  incident: { id: string; incident_number: string; title: string } | null;
  problem: { id: string; problem_number: string; title: string } | null;
  requester: { full_name: string } | null; assignee: { full_name: string } | null;
};
type LedgerRow = { block_height: number; action: string; current_hash: string; timestamp: string };

export function ChangeDetail({ change, ledger, canManage, canApprove }: { change: ChangeView; ledger: LedgerRow[]; canManage: boolean; canApprove: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [cabNotes, setCabNotes] = useState("");
  const nexts = CHANGE_NEXT[change.status] ?? [];
  const atCab = change.status === "pending_cab";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMsg(null);
    start(async () => { const r = await fn(); if (!r.ok) setMsg(r.error ?? "error"); else router.refresh(); });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/changes" />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-2)" }}>{change.change_number}</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, margin: 0, color: "var(--text)" }}>{change.title}</h1>
          <ChangeStatusBadge status={change.status} />
          <RiskBadge risk={change.risk_level} />
          <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{t(("chg.type." + change.change_type) as MessageKey)}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canManage && nexts.map((s) => (
            <button key={s} onClick={() => run(() => changeStatus(change.id, s))} disabled={pending} style={btnGhost}>→ {t(("chg.st." + s) as MessageKey)}</button>
          ))}
          {canManage && <Link href={`/changes/${change.id}/edit`} style={{ ...btnGhost, textDecoration: "none" } as React.CSSProperties}>{t("common.edit")}</Link>}
        </div>
      </div>
      {msg && <div style={{ fontSize: 12, color: "var(--st-critical)" }}>{msg}</div>}

      {atCab && canApprove && (
        <div style={{ background: "var(--st-eval-bg)", border: "1px solid var(--st-eval)", borderRadius: "var(--r-xl)", padding: 18 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{t("chg.cab.title")}</div>
          <textarea value={cabNotes} onChange={(e) => setCabNotes(e.target.value)} placeholder={t("chg.cab.notes")} rows={2}
            style={{ width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", resize: "vertical", marginBottom: 10, fontFamily: "var(--font-ui)" }} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => run(() => cabDecision(change.id, "approved", cabNotes))} disabled={pending}
              style={{ ...btnBase, background: "var(--cta-bg)", color: "var(--cta-fg)", border: "none" }}><Icon name="check" size={13} style={{ verticalAlign: "-2px" }} /> {t("chg.cab.approve")}</button>
            <button onClick={() => run(() => cabDecision(change.id, "rejected", cabNotes))} disabled={pending}
              style={{ ...btnBase, background: "var(--st-critical-bg)", color: "var(--st-critical-fg)", border: "none" }}><Icon name="x" size={13} style={{ verticalAlign: "-2px" }} /> {t("chg.cab.reject")}</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {change.description && <Card title={t("chg.f.description")}><p style={p}>{change.description}</p></Card>}
          {change.justification && <Card title={t("chg.f.justification")}><p style={p}>{change.justification}</p></Card>}
          <Card title={t("chg.f.implementation")}><p style={{ ...p, color: change.implementation_plan ? "var(--text)" : "var(--muted)" }}>{change.implementation_plan ?? "—"}</p></Card>
          <Card title={t("chg.f.rollback")}><p style={{ ...p, color: change.rollback_plan ? "var(--text)" : "var(--muted)" }}>{change.rollback_plan ?? "—"}</p></Card>

          <Card title={t("inc.section.ledger")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ledger.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>—</div>}
              {ledger.map((l) => (
                <div key={l.block_height} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", width: 34 }}>#{l.block_height}</span>
                  <span style={{ color: "var(--text)", flex: 1 }}>{l.action}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-2)", fontSize: 10.5 }}>{l.current_hash.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title={t("chg.section.detail")}>
            <Row label={t("chg.f.requester")} value={change.requester?.full_name} />
            <Row label={t("chg.f.assignee")} value={change.assignee?.full_name} />
            <Row label={t("chg.f.service")} value={change.service?.name} />
            <Row label={t("chg.f.ci")} value={change.ci?.name} />
            <Row label={t("chg.f.pstart")} value={fmt(change.planned_start, locale)} mono />
            <Row label={t("chg.f.pend")} value={fmt(change.planned_end, locale)} mono />
            <Row label={t("chg.f.astart")} value={fmt(change.actual_start, locale)} mono />
            <Row label={t("chg.f.aend")} value={fmt(change.actual_end, locale)} mono />
          </Card>

          {(change.incident || change.problem) && (
            <Card title={t("chg.section.origin")}>
              {change.incident && <div style={link}><Link href={`/incidents/${change.incident.id}`} style={a}>◂ {change.incident.incident_number} · {change.incident.title}</Link></div>}
              {change.problem && <div style={link}><Link href={`/problems/${change.problem.id}`} style={a}>◂ {change.problem.problem_number} · {change.problem.title}</Link></div>}
            </Card>
          )}

          {change.cab_decision && (
            <Card title={t("chg.cab.result")}>
              <Row label={t("chg.cab.decision")} value={t(("chg.cab." + change.cab_decision) as MessageKey)} />
              <Row label={t("chg.cab.at")} value={fmt(change.cab_decision_at, locale)} mono />
              {change.cab_notes && <p style={{ ...p, marginTop: 8 }}>{change.cab_notes}</p>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const p: React.CSSProperties = { margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text)" };
const link: React.CSSProperties = { padding: "6px 0" };
const a: React.CSSProperties = { fontSize: 12, color: "var(--accent-2)", textDecoration: "none", fontWeight: 600 };
const btnBase: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", cursor: "pointer" };
const btnGhost: React.CSSProperties = { ...btnBase, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" };
function fmt(v: string | null, locale: string) { return v ? new Date(v).toLocaleString(locale) : null; }
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14, color: "var(--text)" }}>{title}</div>{children}</div>;
}
function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
    <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
    <span style={{ fontSize: 12.5, color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", textAlign: "right" }}>{value || "—"}</span></div>;
}
