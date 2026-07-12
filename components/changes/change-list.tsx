"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ChangeData } from "@/lib/changes/queries";
import type { ChangeRow } from "@/lib/changes/queries";
import { ChangeStatusBadge, RiskBadge } from "./badges";
import { useListFilters, FilterBar, Drill, type FilterDef } from "@/components/common/filters";

export function ChangeList({ data, canManage }: { data: ChangeData; canManage: boolean }) {
  const { t } = useI18n();
  const defs: FilterDef<ChangeRow>[] = [
    { key: "type", label: t("chg.col.type"), get: (c) => c.change_type, allLabel: t("inc.filter.alltype"), render: (v) => t(("chg.type." + v) as MessageKey) },
    { key: "risk", label: t("chg.col.risk"), get: (c) => c.risk_level, allLabel: t("inc.filter.allrisk"), render: (v) => t(("chg.risk." + v) as MessageKey) },
    { key: "status", label: t("chg.col.status"), get: (c) => c.status, allLabel: t("inc.filter.allstatus"), render: (v) => t(("chg.st." + v) as MessageKey) },
    { key: "resp", label: t("flt.responsible"), get: (c) => c.assignee?.full_name, allLabel: t("flt.allresp") },
  ];
  const f = useListFilters(data.changes, defs);
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8A948A", padding: "10px 12px", background: "var(--head-bg)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("chg.intro")}</div>
        {canManage && <Link href="/changes/new" style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--cta-bg)", color: "var(--cta-fg)", textDecoration: "none" }}>+ {t("chg.new")}</Link>}
      </div>

      <FilterBar defs={defs} filters={f} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Kpi label={t("chg.kpi.open")} value={String(data.stats.open)} />
        <Kpi label={t("chg.kpi.pendingcab")} value={String(data.stats.pendingCab)} color="var(--st-eval)" />
        <Kpi label={t("chg.kpi.scheduled")} value={String(data.stats.scheduled)} />
        <Kpi label={t("chg.kpi.emergency")} value={String(data.stats.emergency)} color="var(--st-critical-fg)" />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "130px 1.7fr 110px 90px 120px 120px", minWidth: 880 }}>
            {[t("chg.col.number"), t("chg.col.title"), t("chg.col.type"), t("chg.col.risk"), t("chg.col.origin"), t("chg.col.status")].map((h) => <div key={h} style={head}>{h}</div>)}
            {f.filtered.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 36, textAlign: "center", color: "var(--muted)" }}>{t("chg.empty")}</div>}
            {f.filtered.map((c) => (
              <Link key={c.id} href={`/changes/${c.id}`} style={{ display: "contents", textDecoration: "none" }}>
                <Cell mono accent>{c.change_number}</Cell>
                <Cell>{c.title}</Cell>
                <Cell muted><Drill onClick={() => f.set("type", c.change_type)}>{t(("chg.type." + c.change_type) as MessageKey)}</Drill></Cell>
                <Cell><Drill onClick={() => f.set("risk", c.risk_level)}><RiskBadge risk={c.risk_level} /></Drill></Cell>
                <Cell muted>{c.related_incident_id ? t("chg.origin.incident") : c.related_problem_id ? t("chg.origin.problem") : "—"}</Cell>
                <Cell><ChangeStatusBadge status={c.status} /></Cell>
              </Link>
            ))}
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
