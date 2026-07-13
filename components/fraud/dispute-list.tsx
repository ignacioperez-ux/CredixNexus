"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { DisputeRow, DisputeStats } from "@/lib/fraud/queries";
import { DisputeStatusBadge } from "./badges";
import { useListFilters, FilterBar, Drill, useGrouping, GroupBar, GroupHeader, EmptyState, type FilterDef } from "@/components/common/filters";

const OPEN = ["opened", "investigating", "awaiting_customer", "submitted"];

export function DisputeList({ rows, stats }: { rows: DisputeRow[]; stats: DisputeStats }) {
  const { t, locale } = useI18n();
  const money = (n: number, c = "CRC") => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);
  const today = new Date().toISOString().slice(0, 10);
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  const defs: FilterDef<DisputeRow>[] = [
    { key: "status", label: t("obs.col.status"), get: (r) => r.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("dp.st." + v) as MessageKey) },
    { key: "type", label: t("fr.col.type"), get: (r) => r.dispute_type, allLabel: t("inc.filter.alltype"), render: (v) => t(("dp.type." + v) as MessageKey) },
  ];
  const f = useListFilters(rows, defs);
  const g = useGrouping(f.filtered, defs);

  function Line(r: DisputeRow) {
    const overdue = OPEN.includes(r.status) && r.due_date && r.due_date < today;
    return (
      <Link key={r.id} href={`/fraud-disputes/dispute/${r.id}`} className="cx-row" style={{ display: "contents", textDecoration: "none" }}>
        <Cell mono accent>{r.dispute_number}</Cell>
        <Cell>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ color: "var(--text)" }}>{r.title}</span>
            <span style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{r.incident_number} · {r.customer_masked}</span>
          </div>
        </Cell>
        <Cell muted><Drill onClick={() => f.set("type", r.dispute_type)}>{t(("dp.type." + r.dispute_type) as MessageKey)}</Drill></Cell>
        <Cell mono muted>{r.disputed_amount != null ? money(r.disputed_amount, r.currency) : "—"}</Cell>
        <Cell mono muted={!overdue}><span style={{ color: overdue ? "var(--st-critical-fg)" : undefined }}>{r.due_date ?? "—"}</span></Cell>
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
        <Kpi label={t("dp.kpi.disputed")} value={money(stats.disputed)} />
        <Kpi label={t("dp.kpi.recovered")} value={money(stats.recovered)} color="var(--st-low-fg)" />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
        <FilterBar defs={defs} filters={f} />
        <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1.5fr 160px 120px 120px 120px", minWidth: 900 }}>
            {[t("dp.col.number"), t("fr.col.case"), t("fr.col.type"), t("dp.col.disputed"), t("dp.col.due"), t("obs.col.status")].map((h) => <div key={h} style={head}>{h}</div>)}
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

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)" };
function Cell({ children, mono, accent, muted }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}>{children}</div>;
}
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 20, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
