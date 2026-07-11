"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { CiRow } from "@/lib/cmdb/queries";
import { useListFilters, FilterBar, Drill, type FilterDef } from "@/components/common/filters";
import { BackButton } from "@/components/common/back-button";

export function CmdbList({ rows, initialType }: { rows: CiRow[]; initialType?: string }) {
  const { t } = useI18n();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 14px", background: "var(--head-bg)" };
  const defs: FilterDef<CiRow>[] = [
    { key: "type", label: t("cmdb.col.type"), get: (c) => c.ci_type, allLabel: t("inc.filter.alltype"), render: (v) => t(("cmdb.type." + v) as MessageKey) },
    { key: "status", label: t("cmdb.col.status"), get: (c) => c.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("sla.st." + v) as MessageKey) },
    { key: "vendor", label: t("cmdb.col.vendor"), get: (c) => c.vendor?.name, allLabel: t("md.filter.all") },
  ];
  const f = useListFilters(rows, defs, initialType ? { type: initialType } : undefined);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <BackButton fallback="/dashboard" />
      <FilterBar defs={defs} filters={f} />
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 130px 1fr 110px", minWidth: 720 }}>
            {[t("cmdb.col.name"), t("cmdb.col.type"), t("cmdb.col.vendor"), t("cmdb.col.status")].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("cmdb.empty")}</div>}
            {f.filtered.map((c) => (
              <div key={c.id} style={{ display: "contents" }}>
                <Cell bold>{c.name}</Cell>
                <Cell><Drill onClick={() => f.set("type", c.ci_type)}><span style={{ fontSize: 10.5, fontWeight: 600, color: c.ci_type === "application" ? "var(--accent-2)" : "var(--st-info)", background: "var(--paper)", padding: "2px 9px", borderRadius: "var(--r-pill)" }}>{t(("cmdb.type." + c.ci_type) as MessageKey)}</span></Drill></Cell>
                <Cell muted>{c.vendor?.name ? <Drill onClick={() => f.set("vendor", c.vendor!.name)}>{c.vendor.name}</Drill> : "—"}</Cell>
                <Cell><span style={{ fontSize: 10.5, fontWeight: 600, color: c.status === "active" ? "var(--st-low-fg)" : "var(--muted)", background: c.status === "active" ? "var(--st-low-bg)" : "var(--paper)", padding: "2px 9px", borderRadius: "var(--r-pill)" }}>{t(("sla.st." + c.status) as MessageKey)}</span></Cell>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "11px 14px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", color: "var(--text)", minWidth: 0 };
function Cell({ children, bold, muted }: { children: React.ReactNode; bold?: boolean; muted?: boolean }) {
  return <div style={{ ...cellSt, fontWeight: bold ? 600 : 400, color: muted ? "var(--muted)" : "var(--text)" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{children}</span></div>;
}
