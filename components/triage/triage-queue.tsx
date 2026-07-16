"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { useErrorMessage } from "@/lib/i18n/provider";
import type { PendingCaseRow } from "@/lib/triage/queries";
import { acceptCase, discardCase } from "@/lib/triage/actions";
import { fmtDurationShort } from "@/lib/sla/thresholds";
import { useListFilters, FilterBar, Drill, EmptyState, type FilterDef } from "@/components/common/filters";

const H24 = 86_400_000, H72 = 3 * 86_400_000;

export function TriageQueue({ rows, canManage }: { rows: PendingCaseRow[]; canManage: boolean }) {
  const { t, locale } = useI18n();
  const errMsg = useErrorMessage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
  const defs: FilterDef<PendingCaseRow>[] = [
    { key: "cat", label: t("inc.col.category"), get: (r) => r.category?.name, allLabel: t("inc.filter.allcat") },
    { key: "app", label: t("inc.col.app"), get: (r) => r.ci?.name, allLabel: t("inc.filter.allapp") },
  ];
  const f = useListFilters(rows, defs);

  function admit(id: string) {
    setBusy(id); setMsg(null);
    start(async () => {
      const r = await acceptCase(id, "incident");
      setBusy(null);
      if (!r.ok) setMsg(errMsg(r.error ?? null) ?? t("tri.act.error"));
      else { setMsg(t("tri.act.admitted")); router.refresh(); }
    });
  }
  function discard(id: string) {
    const reason = window.prompt(t("tri.discard.prompt"));
    if (reason == null) return;
    setBusy(id); setMsg(null);
    start(async () => {
      const r = await discardCase(id, reason);
      setBusy(null);
      if (!r.ok) setMsg(errMsg(r.error ?? null) ?? t("tri.act.error"));
      else { setMsg(t("tri.act.discarded")); router.refresh(); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("tri.queue.intro")}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <FilterBar defs={defs} filters={f} />
        {msg && <div style={{ fontSize: 12, color: "var(--accent-2)" }}>{msg}</div>}
      </div>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: canManage ? "128px 1.5fr 128px 128px 118px 168px" : "128px 1.6fr 130px 130px 118px", minWidth: canManage ? 940 : 780 }}>
            {[t("inc.col.number"), t("inc.col.title"), t("inc.col.category"), t("inc.col.app"), t("tri.col.received"), ...(canManage ? [t("tri.col.actions")] : [])].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <EmptyState text={t("tri.queue.empty")} icon="check" />}
            {f.filtered.map((r) => {
              const age = now == null ? null : now - new Date(r.opened_at).getTime();
              const color = age == null ? "var(--muted)" : age > H72 ? "var(--st-critical-fg)" : age > H24 ? "var(--st-high-fg)" : "var(--muted)";
              return (
                <div key={r.id} className="cx-row" style={{ display: "contents" }}>
                  <Cell mono accent><Link href={`/incidents/${r.id}`} style={{ color: "var(--accent-2)", textDecoration: "none" }}>{r.incident_number}</Link></Cell>
                  <Cell><Link href={`/incidents/${r.id}`} style={{ color: "var(--text)", textDecoration: "none" }}>{r.title}</Link></Cell>
                  <Cell muted>{r.category?.name ? <Drill onClick={() => f.set("cat", r.category!.name)}>{r.category.name}</Drill> : "—"}</Cell>
                  <Cell muted>{r.ci?.name ? <Drill onClick={() => f.set("app", r.ci!.name)}>{r.ci.name}</Drill> : "—"}</Cell>
                  <Cell mono title={new Date(r.opened_at).toLocaleString(locale)}>
                    <span style={{ color, fontWeight: age && age > H24 ? 700 : 400 }}>{age == null ? new Date(r.opened_at).toLocaleDateString(locale) : fmtDurationShort(age)}</span>
                  </Cell>
                  {canManage && (
                    <div style={{ ...cellSt, gap: 6 }}>
                      <button onClick={() => admit(r.id)} disabled={pending && busy === r.id}
                        style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: "var(--r-pill)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer", opacity: pending && busy === r.id ? 0.6 : 1 }}>{t("tri.act.admit")}</button>
                      <button onClick={() => discard(r.id)} disabled={pending && busy === r.id}
                        style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: "var(--r-pill)", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--muted)", cursor: "pointer" }}>{t("tri.act.discard")}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, accent, muted, title }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean; title?: string }) {
  return <div title={title} style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
