"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { Supervisor } from "@/lib/analytics/queries";
import { statusKey } from "@/lib/incidents/labels";

// Command Center del supervisor: control de backlog, aging, carga por agente,
// vencidos, tareas, calidad de cierre y cuellos de botella. Todo sobre datos reales.

const AGING_COLOR: Record<string, string> = { "0-1d": "var(--st-low)", "1-3d": "var(--st-medium)", "3-7d": "var(--st-high)", "7d+": "var(--st-critical)" };

export function SupervisorDashboard({ s }: { s: Supervisor }) {
  const { t } = useI18n();
  const maxAge = Math.max(1, ...s.aging.map((a) => a.count));
  const statuses = Object.entries(s.by_status).sort((a, b) => b[1] - a[1]);
  const maxStatus = Math.max(1, ...statuses.map(([, c]) => c));
  const maxLoad = Math.max(1, ...s.workload.map((w) => w.open));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("sup.intro")}</div>

      {/* Señales de control */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
        <Kpi label={t("sup.open")} value={s.open} href="/incidents" />
        <Kpi label={t("sup.unassigned")} value={s.unassigned} href="/incidents" danger={s.unassigned > 0} />
        <Kpi label={t("sup.overdue")} value={s.overdue} href="/sla-governance" danger={s.overdue > 0} />
        <Kpi label={t("sup.waiting")} value={s.waiting} />
        <Kpi label={t("sup.reopened")} value={s.reopened} danger={s.reopened > 0} />
        <Kpi label={t("sup.tasksoverdue")} value={s.tasks.overdue} danger={s.tasks.overdue > 0} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Aging del backlog */}
        <Panel title={t("sup.aging")}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 130, paddingTop: 10 }}>
            {s.aging.map((a) => (
              <div key={a.bucket} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: AGING_COLOR[a.bucket] }}>{a.count}</span>
                <div style={{ width: "100%", maxWidth: 48, height: `${Math.max(4, (a.count / maxAge) * 90)}px`, background: AGING_COLOR[a.bucket], borderRadius: "5px 5px 0 0", transition: "height var(--t-fast)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)" }}>{a.bucket}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Cuellos de botella por estado */}
        <Panel title={t("sup.bottlenecks")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {statuses.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>—</div>}
            {statuses.map(([st, c]) => (
              <div key={st} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text)", width: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(statusKey(st))}</span>
                <div style={{ flex: 1, height: 8, background: "var(--paper)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(c / maxStatus) * 100}%`, height: "100%", background: "var(--accent-2)" }} /></div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", width: 24, textAlign: "right" }}>{c}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Carga por agente */}
      <Panel title={t("sup.workload")}>
        <div style={{ overflowX: "auto", marginTop: 4 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 480 }}>
            <thead><tr>{[t("sup.agent"), t("sup.assignedopen"), t("sup.overdue"), ""].map((h, i) => <th key={i} style={{ ...th, textAlign: i === 0 ? "left" : i === 3 ? "left" : "right" }}>{h}</th>)}</tr></thead>
            <tbody>
              {s.workload.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>—</td></tr>}
              {s.workload.map((w) => (
                <tr key={w.agent}>
                  <td style={{ ...td, fontWeight: 600, color: "var(--text)" }}>{w.agent}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "var(--font-mono)" }}>{w.open}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "var(--font-mono)", color: w.overdue > 0 ? "var(--st-critical-fg)" : "var(--muted)" }}>{w.overdue}</td>
                  <td style={{ ...td, width: "45%" }}>
                    <div style={{ height: 7, background: "var(--paper)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(w.open / maxLoad) * 100}%`, height: "100%", background: w.overdue > 0 ? "var(--st-high-fg)" : "var(--accent)" }} /></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Calidad de cierre */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Kpi label={t("sup.resolved30")} value={s.quality.resolved_30d} />
        <Kpi label={t("sup.reopenrate")} value={`${s.quality.reopen_rate}%`} danger={s.quality.reopen_rate > 10} />
        <Kpi label={t("sup.tasksopen")} value={s.tasks.open} />
      </div>
    </div>
  );
}

function Kpi({ label, value, href, danger }: { label: string; value: number | string; href?: string; danger?: boolean }) {
  const inner = (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 14, height: "100%" }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: danger ? "var(--st-critical-fg)" : "var(--text)" }}>{value}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{inner}</Link> : inner;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</div>{children}</div>;
}
const th: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "#8A948A", padding: "8px 10px", whiteSpace: "nowrap" };
const td: React.CSSProperties = { fontSize: 12.5, padding: "8px 10px", borderTop: "1px solid var(--line-soft)", color: "var(--muted)" };
