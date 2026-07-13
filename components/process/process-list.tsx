"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ProcessRow, ProcessStats } from "@/lib/process/queries";
import { useListFilters, FilterBar, Drill, useGrouping, GroupBar, GroupHeader, EmptyState, type FilterDef } from "@/components/common/filters";

const COV: Record<string, { fg: string; bg: string }> = {
  covered: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
  single: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
  none: { fg: "var(--muted)", bg: "var(--paper)" },
};

export function ProcessList({ rows, stats }: { rows: ProcessRow[]; stats: ProcessStats }) {
  const { t } = useI18n();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
  const defs: FilterDef<ProcessRow>[] = [
    { key: "level", label: t("proc.col.level"), get: (p) => p.process_level, allLabel: t("md.filter.all"), render: (v) => t(("proc.level." + v) as MessageKey) },
    { key: "cov", label: t("proc.col.coverage"), get: (p) => p.coverage, allLabel: t("md.filter.all"), render: (v) => t(("proc.cov." + v) as MessageKey) },
    { key: "bu", label: t("proc.col.owner"), get: (p) => p.business_unit ?? "—", allLabel: t("md.filter.all") },
  ];
  const f = useListFilters(rows, defs);
  const g = useGrouping(f.filtered, defs);

  function Line(p: ProcessRow) {
    return (
      <Link key={p.id} href={`/processes/${p.id}`} className="cx-row" style={{ display: "contents", textDecoration: "none" }}>
        <Cell bold>{p.name}</Cell>
        <Cell><Drill onClick={() => f.set("level", p.process_level)}><span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: p.process_level === "macro" ? "var(--accent-2)" : "var(--muted)" }}>{t(("proc.level." + p.process_level) as MessageKey)}</span></Drill></Cell>
        <Cell muted>{p.business_unit ?? "—"}</Cell>
        <Cell mono muted>{p.system_count}</Cell>
        <Cell><Drill onClick={() => f.set("cov", p.coverage)}><Pill c={p.coverage} label={t(("proc.cov." + p.coverage) as MessageKey)} /></Drill></Cell>
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("proc.intro")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Kpi label={t("proc.kpi.total")} value={String(stats.total)} />
        <Kpi label={t("proc.kpi.macro")} value={String(stats.macro)} />
        <Kpi label={t("proc.kpi.nocov")} value={String(stats.without_systems)} color={stats.without_systems > 0 ? "var(--st-high-fg)" : undefined} />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
        <FilterBar defs={defs} filters={f} />
        <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 110px 160px 90px 130px", minWidth: 780 }}>
            {[t("proc.col.name"), t("proc.col.level"), t("proc.col.owner"), t("proc.col.systems"), t("proc.col.coverage")].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <EmptyState text={t("proc.empty")} icon="activity" />}
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

function Pill({ c, label }: { c: string; label: string }) {
  const col = COV[c] ?? COV.none;
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: col.fg, background: col.bg, padding: "3px 10px", borderRadius: "var(--r-pill)" }}>{label}</span>;
}
const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)", minWidth: 0 };
function Cell({ children, bold, mono, muted }: { children: React.ReactNode; bold?: boolean; mono?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", fontWeight: bold ? 600 : 400, color: muted ? "var(--muted)" : "var(--text)" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span></div>;
}
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
