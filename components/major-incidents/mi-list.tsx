"use client";

import { Icon } from "@/components/ui/icon";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { MiData, MiRow } from "@/lib/major-incidents/queries";
import { MiStatusBadge, SevBadge } from "./badges";
import { useListFilters, FilterBar, Drill, useGrouping, GroupBar, GroupHeader, EmptyState, type FilterDef } from "@/components/common/filters";

export function MiList({ data }: { data: MiData }) {
  const { t, locale } = useI18n();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
  const now = new Date().toISOString();
  const defs: FilterDef<MiRow>[] = [
    { key: "sev", label: t("mi.col.sev"), get: (m) => m.severity, allLabel: t("inc.filter.allsev"), render: (v) => t(("mi.sev." + v) as MessageKey) },
    { key: "status", label: t("mi.col.status"), get: (m) => m.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("mi.st." + v) as MessageKey) },
    { key: "cmd", label: t("flt.responsible"), get: (m) => m.commander?.full_name, allLabel: t("flt.allresp") },
  ];
  const f = useListFilters(data.incidents, defs);
  const g = useGrouping(f.filtered, defs);

  function Line(m: MiRow) {
    const overdue = m.next_update_due_at && m.next_update_due_at < now && m.status !== "resolved" && m.status !== "stood_down";
    return (
      <Link key={m.id} href={`/major-incidents/${m.id}`} className="cx-row" style={{ display: "contents", textDecoration: "none" }}>
        <Cell mono accent>{m.mi_number}</Cell>
        <Cell><Drill onClick={() => f.set("sev", m.severity)}><SevBadge severity={m.severity} /></Drill></Cell>
        <Cell>{m.title}</Cell>
        <Cell muted>{m.commander?.full_name ?? "—"}</Cell>
        <Cell mono style={overdue ? { color: "var(--st-critical)" } : { color: "var(--muted)" }}>{m.next_update_due_at ? new Date(m.next_update_due_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "—"}{overdue ? <Icon name="alert" size={12} color="var(--st-critical)" style={{ marginLeft: 4, verticalAlign: "-2px" }} /> : ""}</Cell>
        <Cell><MiStatusBadge status={m.status} /></Cell>
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("mi.intro")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Kpi label={t("mi.kpi.active")} value={String(data.stats.active)} />
        <Kpi label={t("mi.kpi.sev1")} value={String(data.stats.sev1)} color="var(--st-critical-fg)" />
        <Kpi label={t("mi.kpi.overdue")} value={String(data.stats.commsOverdue)} color={data.stats.commsOverdue > 0 ? "var(--st-critical-fg)" : undefined} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
        <FilterBar defs={defs} filters={f} />
        <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "104px 54px minmax(100px,1.6fr) 104px 92px 96px", minWidth: 560 }}>
            {[t("mi.col.number"), t("mi.col.sev"), t("mi.col.title"), t("mi.col.commander"), t("mi.col.nextupdate"), t("mi.col.status")].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <EmptyState text={t("mi.empty")} icon="alert" />}
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

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)", minWidth: 0, overflow: "hidden" };
function Cell({ children, mono, accent, muted, style }: { children: React.ReactNode; mono?: boolean; accent?: boolean; muted?: boolean; style?: React.CSSProperties }) {
  return <div style={{ ...cellSt, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", color: accent ? "var(--accent-2)" : muted ? "var(--muted)" : "var(--text)", whiteSpace: "nowrap", textOverflow: "ellipsis", ...style }}>{children}</div>;
}
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
