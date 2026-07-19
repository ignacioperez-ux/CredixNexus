"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { KbData, ArticleRow } from "@/lib/knowledge/queries";
import { ArticleTypeBadge, HealthBadge } from "./badges";
import { useListFilters, FilterBar, Drill, useGrouping, GroupBar, GroupHeader, EmptyState, type FilterDef } from "@/components/common/filters";

export function KbBrowser({ data }: { data: KbData }) {
  const { t } = useI18n();
  const m = data.metrics;
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  const defs: FilterDef<ArticleRow>[] = [
    { key: "type", label: t("kb.col.type"), get: (a) => a.article_type, allLabel: t("inc.filter.alltype"), render: (v) => t(("kb.type." + v) as MessageKey) },
    { key: "cat", label: t("kb.col.category"), get: (a) => a.category, allLabel: t("inc.filter.allcat") },
    { key: "status", label: t("obs.col.status"), get: (a) => a.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("sla.st." + v) as MessageKey) },
    { key: "health", label: t("kb.col.health"), get: (a) => a.health, allLabel: t("md.filter.all"), render: (v) => t(("kb.health." + v) as MessageKey) },
  ];
  const f = useListFilters(data.articles, defs);
  const g = useGrouping(f.filtered, defs);

  function Line(a: ArticleRow) {
    return (
      <Link key={a.id} href={`/knowledge/${a.id}`} className="cx-row" style={{ display: "contents", textDecoration: "none" }}>
        <Cell mono accent>{a.article_number}</Cell>
        <Cell>{a.title}{a.status !== "active" && <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 8 }}>({t(("sla.st." + a.status) as MessageKey)})</span>}</Cell>
        <Cell><Drill onClick={() => f.set("type", a.article_type)}><ArticleTypeBadge type={a.article_type} /></Drill></Cell>
        <Cell muted><Drill onClick={() => f.set("cat", a.category)}>{a.category}</Drill></Cell>
        <Cell mono muted>{a.view_count}</Cell>
        <Cell mono muted>{a.deflection_count}</Cell>
        <Cell><Drill onClick={() => f.set("health", a.health)}><HealthBadge health={a.health} pct={a.helpful_pct} /></Drill></Cell>
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("kb.intro")}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        <Kpi label={t("kb.kpi.articles")} value={String(m.active)} />
        <Kpi label={t("kb.kpi.helpful")} value={m.helpful_pct != null ? `${m.helpful_pct}%` : "—"} color={m.helpful_pct != null && m.helpful_pct >= 70 ? "var(--st-low-fg)" : undefined} />
        <Kpi label={t("kb.kpi.deflections")} value={String(m.deflections)} color="var(--st-low-fg)" />
        <Kpi label={t("kb.kpi.escalations")} value={String(m.escalations)} color={m.escalations > 0 ? "var(--st-high-fg)" : undefined} />
        <Kpi label={t("kb.kpi.review")} value={String(m.needs_review)} color={m.needs_review > 0 ? "var(--st-critical-fg)" : undefined} />
      </div>

      {m.by_type.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {m.by_type.map((x) => (
            <button key={x.type} onClick={() => f.set("type", x.type)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, padding: "6px 11px", borderRadius: "var(--r-pill)", background: "var(--card)", border: "1px solid var(--line)", color: "var(--text)", cursor: "pointer" }}>
              {t(("kb.type." + x.type) as MessageKey)} <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{x.count}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
        <FilterBar defs={defs} filters={f} />
        <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1.7fr 120px 130px 90px 90px 130px", minWidth: 800 }}>
            {[t("kb.col.number"), t("kb.col.title"), t("kb.col.type"), t("kb.col.category"), t("kb.col.views"), t("kb.col.deflect"), t("kb.col.health")].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <EmptyState text={t("kb.empty")} icon="search" />}
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
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span></div>;
}
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 20, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
