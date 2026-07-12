"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ProblemData, ProblemRow } from "@/lib/problems/queries";
import { ProblemStatusBadge, PROB_PRIORITY_COLOR } from "./badges";
import { useListFilters, FilterBar, Drill, useGrouping, GroupBar, GroupHeader, type FilterDef } from "@/components/common/filters";

export function ProblemList({ data, canManage }: { data: ProblemData; canManage: boolean }) {
  const { t } = useI18n();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
  const defs: FilterDef<ProblemRow>[] = [
    { key: "status", label: t("prob.col.status"), get: (p) => p.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("prob.st." + v) as MessageKey) },
    { key: "prio", label: t("prob.col.priority"), get: (p) => p.priority, allLabel: t("inc.filter.allprio"), render: (v) => t(("prob.prio." + v) as MessageKey) },
    { key: "cat", label: t("prob.col.category"), get: (p) => p.category, allLabel: t("inc.filter.allcat") },
    { key: "owner", label: t("flt.responsible"), get: (p) => p.owner?.full_name, allLabel: t("flt.allresp") },
  ];
  const f = useListFilters(data.problems, defs);
  const g = useGrouping(f.filtered, defs);

  function Line(p: ProblemRow) {
    const pc = PROB_PRIORITY_COLOR[p.priority] ?? PROB_PRIORITY_COLOR.medium;
    return (
      <Link key={p.id} href={`/problems/${p.id}`} style={{ display: "contents", textDecoration: "none" }}>
        <Cell mono accent>{p.problem_number}</Cell>
        <Cell>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
          {p.known_error && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--st-high-fg)", background: "var(--st-high-bg)", padding: "1px 6px", borderRadius: "var(--r-pill)", marginLeft: 8, flexShrink: 0 }}>{t("prob.knownerror")}</span>}
        </Cell>
        <Cell muted>{p.category ? <Drill onClick={() => f.set("cat", p.category!)}>{p.category}</Drill> : "—"}</Cell>
        <Cell><Drill onClick={() => f.set("prio", p.priority)}><span style={{ fontSize: 10.5, fontWeight: 600, color: pc.fg, background: pc.bg, padding: "2px 9px", borderRadius: "var(--r-pill)" }}>{t(("prob.prio." + p.priority) as MessageKey)}</span></Drill></Cell>
        <Cell mono muted>{p.linked_count}</Cell>
        <Cell><ProblemStatusBadge status={p.status} /></Cell>
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("prob.intro")}</div>
        {canManage && (
          <Link href="/problems/new" style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", textDecoration: "none" }}>
            + {t("prob.new")}
          </Link>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Kpi label={t("prob.kpi.open")} value={String(data.stats.open)} />
        <Kpi label={t("prob.kpi.known")} value={String(data.stats.knownErrors)} accent />
        <Kpi label={t("prob.kpi.resolved")} value={String(data.stats.resolved)} />
        <Kpi label={t("prob.kpi.linked")} value={String(data.stats.linkedIncidents)} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
        <FilterBar defs={defs} filters={f} />
        <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "130px 1.7fr 110px 90px 90px 130px", minWidth: 860 }}>
            {[t("prob.col.number"), t("prob.col.title"), t("prob.col.category"), t("prob.col.priority"), t("prob.col.linked"), t("prob.col.status")].map((h) => (
              <div key={h} style={head}>{h}</div>
            ))}
            {f.filtered.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("prob.empty")}</div>}
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
function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: accent ? "var(--st-high-fg)" : "var(--text)" }}>{value}</div></div>;
}
