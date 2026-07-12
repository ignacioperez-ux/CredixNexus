"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { VendorData, VendorRow } from "@/lib/vendors/queries";
import { CriticalityBadge, VendorStatusBadge } from "./badges";
import { useListFilters, FilterBar, Drill, useGrouping, GroupBar, GroupHeader, type FilterDef } from "@/components/common/filters";

export function VendorList({ data, canManage }: { data: VendorData; canManage: boolean }) {
  const { t } = useI18n();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };
  const defs: FilterDef<VendorRow>[] = [
    { key: "cat", label: t("vnd.col.category"), get: (v) => v.category, allLabel: t("inc.filter.allcat"), render: (v) => t(("vnd.cat." + v) as MessageKey) },
    { key: "crit", label: t("vnd.col.criticality"), get: (v) => v.criticality, allLabel: t("inc.filter.allcrit"), render: (v) => t(("vnd.crit." + v) as MessageKey) },
    { key: "status", label: t("vnd.col.status"), get: (v) => v.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("sla.st." + v) as MessageKey) },
  ];
  const f = useListFilters(data.vendors, defs);
  const g = useGrouping(f.filtered, defs);

  function Line(v: VendorRow) {
    return (
      <Link key={v.id} href={`/vendors/${v.id}`} style={{ display: "contents", textDecoration: "none" }}>
        <Cell mono accent>{v.code}</Cell>
        <Cell>{v.name}</Cell>
        <Cell muted><Drill onClick={() => f.set("cat", v.category)}>{t(("vnd.cat." + v.category) as MessageKey)}</Drill></Cell>
        <Cell><Drill onClick={() => f.set("crit", v.criticality)}><CriticalityBadge criticality={v.criticality} /></Drill></Cell>
        <Cell mono muted>{v.system_count}</Cell>
        <Cell><VendorStatusBadge status={v.status} /></Cell>
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("vnd.intro")}</div>
        {canManage && <Link href="/vendors/new" style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", textDecoration: "none" }}>+ {t("vnd.new")}</Link>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Kpi label={t("vnd.kpi.active")} value={String(data.stats.active)} />
        <Kpi label={t("vnd.kpi.critical")} value={String(data.stats.critical)} color="var(--st-critical-fg)" />
        <Kpi label={t("vnd.kpi.expiring")} value={String(data.stats.expiringSoon)} color={data.stats.expiringSoon > 0 ? "var(--st-high-fg)" : undefined} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
        <FilterBar defs={defs} filters={f} />
        <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1.6fr 150px 100px 90px 100px", minWidth: 840 }}>
            {[t("vnd.col.code"), t("vnd.col.name"), t("vnd.col.category"), t("vnd.col.criticality"), t("vnd.col.systems"), t("vnd.col.status")].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("vnd.empty")}</div>}
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
    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div></div>;
}
