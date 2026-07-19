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
import { Icon } from "@/components/ui/icon";

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
          <div style={{ display: "grid", gridTemplateColumns: canManage ? "108px minmax(100px,1.3fr) 92px 92px 84px 76px" : "108px minmax(130px,1.5fr) 116px 116px 96px", minWidth: canManage ? 560 : 540 }}>
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
                    <div style={{ ...cellSt, gap: 6, justifyContent: "flex-start" }}>
                      {/* Acciones compactas (icono + tooltip) para que la columna quepa sin recortar. */}
                      <button onClick={() => admit(r.id)} disabled={pending && busy === r.id} title={t("tri.act.admit")} aria-label={t("tri.act.admit")}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "var(--r-md)", border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)", cursor: "pointer", opacity: pending && busy === r.id ? 0.6 : 1, flexShrink: 0 }}>
                        <Icon name="check" size={14} color="var(--cta-fg)" /></button>
                      <button onClick={() => discard(r.id)} disabled={pending && busy === r.id} title={t("tri.act.discard")} aria-label={t("tri.act.discard")}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--muted)", cursor: "pointer", flexShrink: 0 }}>
                        <Icon name="x" size={14} color="var(--muted)" /></button>
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

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)", minWidth: 0, overflow: "hidden" };
function Cell({ children, mono, accent, muted, title }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean; title?: string }) {
  return <div title={title} style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{children}</div>;
}
