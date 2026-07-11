"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { Performance } from "@/lib/analytics/queries";
import { csatLabel, satisfiedLabel, isLowCsat } from "@/lib/analytics/csat";

export function PerformanceTab({ p }: { p: Performance }) {
  const { t } = useI18n();
  const hours = (h: number) => (h > 0 ? `${h}h` : "—");
  const eff = (m: number) => (m > 0 ? `${Math.round((m / 60) * 10) / 10}h` : "—");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("perf.csat.hint")}</div>

      {/* Por area */}
      <Section title={t("perf.byarea")}>
        <Table
          cols={[t("perf.area"), t("an.openinc"), t("perf.resolved30"), t("an.mttr"), t("an.slabreached"), t("perf.csat"), t("perf.satisfied")]}
          rows={p.by_area.map((a) => [a.name, String(a.open_incidents), String(a.resolved_30d), hours(a.mttr_hours), String(a.sla_breached), csatLabel(a), satisfiedLabel(a)])}
          danger={{ 4: (v) => Number(v) > 0, 5: (_v, i) => isLowCsat(p.by_area[i]) }}
        />
      </Section>

      {/* Por servicio */}
      <Section title={t("perf.byservice")}>
        <Table
          cols={[t("perf.service"), t("an.openinc"), t("perf.resolved30"), t("an.mttr"), t("perf.csat"), t("perf.satisfied")]}
          rows={p.by_service.map((s) => [s.name, String(s.open_incidents), String(s.resolved_30d), hours(s.mttr_hours), csatLabel(s), satisfiedLabel(s)])}
          danger={{ 4: (_v, i) => isLowCsat(p.by_service[i]) }}
        />
      </Section>

      {/* Por persona (agente) */}
      <Section title={t("perf.byperson")}>
        <Table
          cols={[t("perf.person"), t("perf.assignedopen"), t("perf.resolved"), t("an.mttr"), t("perf.reopened"), t("perf.csat"), t("perf.satisfied")]}
          rows={p.by_person.map((m) => [m.name + (m.is_external ? " · EXT" : ""), String(m.assigned_open), String(m.resolved_total), hours(m.mttr_hours), String(m.reopened), csatLabel(m), satisfiedLabel(m)])}
          danger={{ 4: (v) => Number(v) > 0, 6: (_v, i) => isLowCsat(p.by_person[i]) }}
        />
      </Section>

      {/* Por squad */}
      <Section title={t("perf.bysquad")}>
        <Table
          cols={[t("perf.squad"), t("perf.members"), t("perf.allocation"), t("perf.projects"), t("perf.qapassed"), t("perf.qaauth")]}
          rows={p.by_squad.map((s) => [s.name, String(s.members), `${s.allocation_pct}%`, String(s.projects), String(s.qa_passed), String(s.qa_authorized)])}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div>
    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 10 }}>{title}</div>
    {children}</div>;
}

function Table({ cols, rows, danger = {} }: { cols: string[]; rows: string[][]; danger?: Record<number, (v: string, rowIndex: number) => boolean> }) {
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#8A948A", padding: "9px 12px", background: "var(--head-bg)", textAlign: "left", whiteSpace: "nowrap", position: "sticky", top: 0 };
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
          <thead><tr>{cols.map((c, i) => <th key={i} style={{ ...head, textAlign: i === 0 ? "left" : "right" }}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length} style={{ padding: 28, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>—</td></tr>}
            {rows.map((r, i) => (
              <tr key={i}>{r.map((cell, j) => (
                <td key={j} style={{ fontSize: 12.5, padding: "9px 12px", borderTop: "1px solid var(--line-soft)", textAlign: j === 0 ? "left" : "right",
                  fontFamily: j === 0 ? "var(--font-ui)" : "var(--font-mono)",
                  fontWeight: j === 0 ? 600 : 400,
                  color: danger[j]?.(cell, i) ? "var(--st-critical-fg)" : (j === 0 ? "var(--text)" : "var(--muted)") }}>{cell}</td>
              ))}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
