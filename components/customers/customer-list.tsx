"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { CustomerRow } from "@/lib/customers/queries";
import { maskTaxId } from "@/lib/customers/queries";
import { useListFilters, FilterBar, Drill, useGrouping, GroupBar, GroupHeader, EmptyState, type FilterDef } from "@/components/common/filters";

const riskColor: Record<string, { fg: string; bg: string }> = {
  critical: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
  high: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
  medium: { fg: "var(--st-medium-fg)", bg: "var(--st-medium-bg)" },
  low: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
};

export function CustomerList({ rows }: { rows: CustomerRow[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 14px", background: "var(--head-bg)" };
  const defs: FilterDef<CustomerRow>[] = [
    { key: "segment", label: t("cust.segment"), get: (c) => c.segment, allLabel: t("inc.filter.allstatus") },
    { key: "risk", label: t("cust.risk"), get: (c) => c.risk_level, allLabel: t("inc.filter.allrisk"), render: (v) => t(("lvl." + v) as MessageKey) },
  ];
  const f = useListFilters(rows, defs);
  const g = useGrouping(f.filtered, defs);

  function Line(c: CustomerRow) {
    const rc = riskColor[c.risk_level] ?? riskColor.low;
    return (
      <div key={c.id} onClick={() => router.push(`/customers/${c.id}`)} className="cx-row" style={{ display: "contents", cursor: "pointer" }}>
        <Cell>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.display_name}</span>
            {c.vip_flag && <span style={{ fontSize: 9.5, padding: "1px 7px", borderRadius: "var(--r-pill)", background: "var(--accent-soft)", color: "var(--accent-2)", fontWeight: 700, flexShrink: 0 }}>VIP</span>}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)" }}>{maskTaxId(c.tax_id)}</div>
        </Cell>
        <Cell muted>{c.segment ? <Drill onClick={() => f.set("segment", c.segment!)}>{c.segment}</Drill> : "—"}</Cell>
        <div style={{ ...cellSt, justifyContent: "center" }}>
          <Drill onClick={() => f.set("risk", c.risk_level)}><span style={{ fontSize: 10.5, padding: "2px 9px", borderRadius: "var(--r-pill)", color: rc.fg, background: rc.bg, fontWeight: 600 }}>{t(("lvl." + c.risk_level) as MessageKey)}</span></Drill>
        </div>
        <div style={{ ...cellSt, justifyContent: "flex-end", fontFamily: "var(--font-mono)", color: c.openCases > 0 ? "var(--st-high-fg)" : "var(--muted)" }}>{c.openCases}</div>
        <div style={{ ...cellSt, justifyContent: "flex-end", fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{c.totalCases}</div>
        <Cell muted mono>{c.lastInteraction ? new Date(c.lastInteraction).toLocaleDateString(locale) : "—"}</Cell>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
        <FilterBar defs={defs} filters={f} />
        <GroupBar defs={defs} groupKey={g.groupKey} setGroupKey={g.setGroupKey} label={t("flt.groupby")} allLabel={t("flt.nogroup")} />
      </div>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 130px 100px 90px 80px 130px", minWidth: 720 }}>
            <div style={head}>{t("cust.col.customer")}</div>
            <div style={head}>{t("cust.segment")}</div>
            <div style={{ ...head, textAlign: "center" }}>{t("cust.risk")}</div>
            <div style={{ ...head, textAlign: "right" }}>{t("cust.col.open")}</div>
            <div style={{ ...head, textAlign: "right" }}>{t("cust.col.total")}</div>
            <div style={head}>{t("cust.col.last")}</div>

            {f.filtered.length === 0 && <EmptyState text={t("cust.empty")} icon="user" />}

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

const cellSt: React.CSSProperties = { fontSize: 12.5, padding: "12px 14px", borderTop: "1px solid var(--line-soft)", color: "var(--text)", display: "flex", alignItems: "center" };
function Cell({ children, muted, mono }: { children: React.ReactNode; muted?: boolean; mono?: boolean }) {
  return <div style={{ ...cellSt, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 2, color: muted ? "var(--muted)" : "var(--text)", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)" }}>{children}</div>;
}
