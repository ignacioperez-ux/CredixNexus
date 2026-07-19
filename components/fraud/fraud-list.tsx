"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { FraudRow, FraudStats } from "@/lib/fraud/queries";
import { money, moneyShort } from "@/lib/format/money";
import { FraudStatusBadge } from "./badges";
import { useListFilters, FilterBar, Drill, useGrouping, GroupBar, GroupHeader, EmptyState, type FilterDef } from "@/components/common/filters";

export function FraudList({ rows, stats }: { rows: FraudRow[]; stats: FraudStats }) {
  const { t, locale } = useI18n();
  const cur = rows[0]?.currency ?? "CRC";
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)", whiteSpace: "nowrap" };

  const defs: FilterDef<FraudRow>[] = [
    { key: "status", label: t("obs.col.status"), get: (r) => r.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("fr.st." + v) as MessageKey) },
    { key: "type", label: t("fr.col.type"), get: (r) => r.fraud_type, allLabel: t("inc.filter.alltype"), render: (v) => t(("fr.type." + v) as MessageKey) },
    { key: "src", label: t("fr.col.source"), get: (r) => r.detection_source, allLabel: t("md.filter.all"), render: (v) => t(("fr.src." + v) as MessageKey) },
  ];
  const f = useListFilters(rows, defs);
  const g = useGrouping(f.filtered, defs);

  function Line(r: FraudRow) {
    return (
      <Link key={r.id} href={`/fraud-disputes/fraud/${r.id}`} className="cx-row" style={{ display: "contents", textDecoration: "none" }}>
        <Cell mono accent>{r.fraud_number}</Cell>
        <Cell>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ color: "var(--text)" }}>{r.title}</span>
            <span style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{r.incident_number} · {r.customer_masked}</span>
          </div>
        </Cell>
        <Cell muted><Drill onClick={() => f.set("type", r.fraud_type)}>{t(("fr.type." + r.fraud_type) as MessageKey)}</Drill></Cell>
        <Cell muted><Drill onClick={() => f.set("src", r.detection_source)}>{t(("fr.src." + r.detection_source) as MessageKey)}</Drill></Cell>
        <Cell mono>{r.risk_score ?? "—"}</Cell>
        <Cell mono muted right>{r.amount_exposed != null ? <span title={money(r.amount_exposed, r.currency, locale)}>{moneyShort(r.amount_exposed, r.currency, locale)}</span> : "—"}</Cell>
        <Cell><Drill onClick={() => f.set("status", r.status)}><FraudStatusBadge status={r.status} /></Drill></Cell>
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("fr.intro")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Kpi label={t("fr.kpi.open")} value={String(stats.open)} color={stats.open > 0 ? "var(--st-high-fg)" : undefined} />
        <Kpi label={t("fr.kpi.confirmed")} value={String(stats.confirmed)} color={stats.confirmed > 0 ? "var(--st-critical-fg)" : undefined} />
        <Kpi label={t("fr.kpi.exposed")} value={money(stats.exposed, cur, locale)} />
        <Kpi label={t("fr.kpi.recovered")} value={money(stats.recovered, cur, locale)} color="var(--st-low-fg)" />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
        <FilterBar defs={defs} filters={f} />
        <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1.5fr 150px 150px 90px 110px 120px", minWidth: 800 }}>
            {[t("fr.col.number"), t("fr.col.case"), t("fr.col.type"), t("fr.col.source"), t("fr.col.risk"), t("fr.col.exposed"), t("obs.col.status")].map((h, i) => <div key={h} style={{ ...head, textAlign: i === 5 ? "right" : "left" }}>{h}</div>)}
            {f.filtered.length === 0 && <EmptyState text={t("fr.empty")} icon="shield" />}
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
