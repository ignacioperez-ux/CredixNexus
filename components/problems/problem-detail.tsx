"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { LinkedIncident } from "@/lib/problems/queries";
import { ProblemStatusBadge, PROB_PRIORITY_COLOR } from "./badges";
import { PROBLEM_NEXT } from "@/lib/problems/validation";
import { changeProblemStatus, linkIncidentToProblem, unlinkIncidentFromProblem } from "@/lib/problems/actions";
import { ChangeLink } from "@/components/changes/change-link";
import { BackButton } from "@/components/common/back-button";

type ProblemView = {
  id: string;
  problem_number: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  root_cause_summary: string | null;
  workaround: string | null;
  known_error: boolean;
  resolution_summary: string | null;
  opened_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  owner: { full_name: string } | null;
  service: { name: string } | null;
  ci: { name: string; ci_type: string } | null;
};
type Linkable = { id: string; incident_number: string; title: string; status: string };
type LedgerRow = { block_height: number; action: string; current_hash: string; timestamp: string };
type ChangeLinked = { id: string; change_number: string; title: string; status: string; risk_level: string };

const NEXT = PROBLEM_NEXT;

export function ProblemDetail({ problem, linked, linkable, ledger, canManage, changes = [], canManageChange = false }: { problem: ProblemView; linked: LinkedIncident[]; linkable: Linkable[]; ledger: LedgerRow[]; canManage: boolean; changes?: ChangeLinked[]; canManageChange?: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const pc = PROB_PRIORITY_COLOR[problem.priority] ?? PROB_PRIORITY_COLOR.medium;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.error ?? "error");
      else router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BackButton fallback="/problems" />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-2)" }}>{problem.problem_number}</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.3px", margin: 0, color: "var(--text)" }}>{problem.title}</h1>
          <ProblemStatusBadge status={problem.status} />
          <span style={{ fontSize: 10.5, fontWeight: 600, color: pc.fg, background: pc.bg, padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{t(("prob.prio." + problem.priority) as MessageKey)}</span>
          {problem.known_error && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--st-high-fg)", background: "var(--st-high-bg)", padding: "2px 8px", borderRadius: "var(--r-pill)" }}>{t("prob.knownerror")}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canManage && (NEXT[problem.status] ?? []).map((s) => (
            <button key={s} onClick={() => run(() => changeProblemStatus(problem.id, s))} disabled={pending}
              style={{ fontSize: 12, fontWeight: 600, padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--text)", cursor: pending ? "default" : "pointer" }}>
              → {t(("prob.st." + s) as MessageKey)}
            </button>
          ))}
          {canManage && (
            <Link href={`/problems/${problem.id}/edit`} style={{ fontSize: 12, fontWeight: 600, padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", textDecoration: "none" }}>{t("common.edit")}</Link>
          )}
        </div>
      </div>
      {msg && <div style={{ fontSize: 12, color: "var(--st-critical)" }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {problem.description && <Card title={t("prob.field.description")}><p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text)" }}>{problem.description}</p></Card>}

          <Card title={t("prob.field.rca")}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: problem.root_cause_summary ? "var(--text)" : "var(--muted)" }}>{problem.root_cause_summary ?? t("prob.rca.none")}</p>
          </Card>

          <Card title={t("prob.field.workaround")}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: problem.workaround ? "var(--text)" : "var(--muted)" }}>{problem.workaround ?? t("prob.wa.none")}</p>
          </Card>

          <Card title={`${t("prob.section.linked")} (${linked.length})`}>
            {canManage && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <select value={pick} onChange={(e) => setPick(e.target.value)}
                  style={{ flex: 1, fontSize: 12.5, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" }}>
                  <option value="">{t("prob.link.pick")}</option>
                  {linkable.map((i) => <option key={i.id} value={i.id}>{i.incident_number} — {i.title}</option>)}
                </select>
                <button onClick={() => pick && run(() => linkIncidentToProblem(problem.id, pick))} disabled={pending || !pick}
                  style={{ fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: pending || !pick ? "default" : "pointer" }}>
                  {t("prob.link.add")}
                </button>
              </div>
            )}
            {linked.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("prob.link.none")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {linked.map((l) => l.incident && (
                  <div key={l.link_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: "var(--r-md)", background: "var(--paper)" }}>
                    <Link href={`/incidents/${l.incident.id}`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)", textDecoration: "none" }}>{l.incident.incident_number}</Link>
                    <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1 }}>{l.incident.title}</span>
                    <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{l.incident.status}</span>
                    {canManage && (
                      <button onClick={() => run(() => unlinkIncidentFromProblem(problem.id, l.incident!.id))} disabled={pending}
                        title={t("prob.link.remove")}
                        style={{ fontSize: 12, padding: "2px 8px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--st-critical)", cursor: pending ? "default" : "pointer" }}><Icon name="x" size={13} /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title={t("inc.section.ledger")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ledger.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>—</div>}
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

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title={t("prob.section.detail")}>
            <Row label={t("prob.field.owner")} value={problem.owner?.full_name} />
            <Row label={t("prob.field.category")} value={problem.category} />
            <Row label={t("prob.field.service")} value={problem.service?.name} />
            <Row label={t("prob.field.ci")} value={problem.ci?.name} />
            <Row label={t("prob.field.opened")} value={new Date(problem.opened_at).toLocaleString(locale)} mono />
            <Row label={t("prob.field.resolved")} value={problem.resolved_at ? new Date(problem.resolved_at).toLocaleString(locale) : null} mono />
            <Row label={t("prob.field.closed")} value={problem.closed_at ? new Date(problem.closed_at).toLocaleString(locale) : null} mono />
          </Card>

          <Card title={t("chg.section.problem")}>
            <ChangeLink changes={changes} canManage={canManageChange} newHref={`/changes/new?problem=${problem.id}`} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 14, color: "var(--text)" }}>{title}</div>
    {children}</div>;
}
function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
    <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
    <span style={{ fontSize: 12.5, color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", textAlign: "right" }}>{value || "—"}</span></div>;
}
