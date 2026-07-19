"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { DisputeRow, DisputeStats } from "@/lib/fraud/queries";
import { money, moneyShort } from "@/lib/format/money";
import { DisputeStatusBadge } from "./badges";
import { useListFilters, FilterBar, Drill, useGrouping, GroupBar, GroupHeader, EmptyState, type FilterDef } from "@/components/common/filters";

const OPEN = ["opened", "investigating", "awaiting_customer", "submitted"];
const MS_DAY = 86_400_000;

export function DisputeList({ rows, stats }: { rows: DisputeRow[]; stats: DisputeStats }) {
  const { t, locale } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)", whiteSpace: "nowrap" };

  const defs: FilterDef<DisputeRow>[] = [
    { key: "status", label: t("obs.col.status"), get: (r) => r.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("dp.st." + v) as MessageKey) },
    { key: "type", label: t("fr.col.type"), get: (r) => r.dispute_type, allLabel: t("inc.filter.alltype"), render: (v) => t(("dp.type." + v) as MessageKey) },
  ];
  const f = useListFilters(rows, defs);
  const g = useGrouping(f.filtered, defs);

  // Suma de monto disputado por estado (de la vista filtrada).
  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of f.filtered) m.set(r.status, (m.get(r.status) ?? 0) + (r.disputed_amount ?? 0));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [f.filtered]);
  const cur = rows[0]?.currency ?? "CRC";

  function daysUntil(due: string): number {
    return Math.round((Date.parse(due + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / MS_DAY);
  }
  function DueChip({ due, status }: { due: string | null; status: string }) {
    if (!due) return <span style={{ color: "var(--muted)" }}>—</span>;
    const d = daysUntil(due);
    const open = OPEN.includes(status);
    const overdue = open && d < 0;
    const soon = open && d >= 0 && d <= 3;
    const color = overdue ? "var(--st-critical-fg)" : soon ? "var(--st-high-fg)" : "var(--muted)";
    const bg = overdue ? "var(--st-critical-bg)" : soon ? "var(--st-high-bg)" : "var(--paper)";
    const label = d < 0 ? `${t("dp.due.overdue")} ${-d} d` : d === 0 ? t("dp.due.today") : `${t("dp.due.in")} ${d} d`;
    return <span title={due} style={{ fontSize: 10.5, fontWeight: 600, color, background: bg, padding: "3px 9px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap" }}>{label}</span>;
  }

  function Line(r: DisputeRow) {
    return (
      <Link key={r.id} href={`/fraud-disputes/dispute/${r.id}`} className="cx-row" style={{ display: "contents", textDecoration: "none" }}>
        <Cell mono accent>{r.dispute_number}</Cell>
        <Cell>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
            <span style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.incident_number} · {r.customer_masked}</span>
          </div>
        </Cell>
        <Cell muted><Drill onClick={() => f.set("type", r.dispute_type)}>{t(("dp.type." + r.dispute_type) as MessageKey)}</Drill></Cell>
        <Cell mono muted right>{r.disputed_amount != null ? <span title={money(r.disputed_amount, r.currency, locale)}>{moneyShort(r.disputed_amount, r.currency, locale)}</span> : "—"}</Cell>
        <Cell><DueChip due={r.due_date} status={r.status} /></Cell>
        <Cell><Drill onClick={() => f.set("status", r.status)}><DisputeStatusBadge status={r.status} /></Drill></Cell>
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("dp.intro")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Kpi label={t("dp.kpi.open")} value={String(stats.open)} color={stats.open > 0 ? "var(--st-high-fg)" : undefined} />
        <Kpi label={t("dp.kpi.overdue")} value={String(stats.overdue)} color={stats.overdue > 0 ? "var(--st-critical-fg)" : undefined} />
        <Kpi label={t("dp.kpi.disputed")} value={money(stats.disputed, cur, locale)} />
        <Kpi label={t("dp.kpi.recovered")} value={money(stats.recovered, cur, locale)} color="var(--st-low-fg)" />
      </div>

      {/* Suma de monto disputado por estado (vista filtrada) */}
      {byStatus.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>{t("dp.sum.title")}</span>
          {byStatus.map(([st, sum]) => (
            <span key={st} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, padding: "4px 10px", borderRadius: "var(--r-pill)", border: "1px solid var(--line)", background: "var(--card)" }}>
              <span style={{ color: "var(--muted)" }}>{t(("dp.st." + st) as MessageKey)}</span>
              <span title={money(sum, cur, locale)} style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text)" }}>{moneyShort(sum, cur, locale)}</span>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
        <FilterBar defs={defs} filters={f} />
        <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "114px minmax(180px, 1.4fr) 140px 118px 150px 128px", minWidth: 740 }}>
            {[t("dp.col.number"), t("fr.col.case"), t("fr.col.type"), t("dp.col.disputed"), t("dp.col.due"), t("obs.col.status")].map((h, i) => <div key={h} style={{ ...head, textAlign: i === 3 ? "right" : "left" }}>{h}</div>)}
            {f.filtered.length === 0 && <EmptyState text={t("dp.empty")} icon="shield" />}
            {g.groups
              ? g.groups.map((grp) => (
                  <div key={grp.value} style={{ display: "contents" }}>
                    <GroupHeader label={grp.label} count={grp.rows.length} />
                    {grp.rows.map(Line)}
                  </div>
                ))
              : f.filtered.map(Line)}
          </div>
        </div>
      </div>
    </div>
  );
}

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)", minWidth: 0 };
function Cell({ children, mono, accent, muted, right }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean; right?: boolean }) {
  return <div style={{ ...cellSt, justifyContent: right ? "flex-end" : "flex-start", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 20, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
