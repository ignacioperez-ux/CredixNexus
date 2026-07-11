"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { Overview } from "@/lib/analytics/queries";
import { serviceHealth, trendMax } from "@/lib/analytics/format";

const HEALTH_COLOR: Record<string, string> = { healthy: "var(--st-low-fg)", degraded: "var(--st-high-fg)", critical: "var(--st-critical-fg)" };

export function ExecDashboard({ o }: { o: Overview }) {
  const { t, locale } = useI18n();
  const health = serviceHealth({ p1Open: o.incidents.p1_open, slaBreached: o.incidents.sla_breached, sev1: o.major_incidents.sev1, unackEscalations: o.escalations.unack });
  const fmtMoney = (n: number) => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(n);
  const tmax = trendMax(o.trend);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Scorecard salud + señales criticas */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 22, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px" }}>{t("an.health")}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 52, fontWeight: 600, letterSpacing: "-2px", color: HEALTH_COLOR[health.label], lineHeight: 1 }}>{health.score}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: HEALTH_COLOR[health.label] }}>{t(("an.health." + health.label) as MessageKey)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Metric label={t("an.p1open")} value={o.incidents.p1_open} href="/incidents" danger={o.incidents.p1_open > 0} />
          <Metric label={t("an.slabreached")} value={o.incidents.sla_breached} href="/sla-governance" danger={o.incidents.sla_breached > 0} />
          <Metric label={t("an.mi")} value={o.major_incidents.active} href="/major-incidents" danger={o.major_incidents.sev1 > 0} />
          <Metric label={t("an.unack")} value={o.escalations.unack} href="/sla-governance" />
          <Metric label={t("an.openinc")} value={o.incidents.open} href="/incidents" />
          <Metric label={t("an.mttr")} value={`${o.incidents.mttr_hours}h`} />
          <Metric label={t("an.evolution")} value={o.incidents.in_evolution} href="/incidents" />
          <Metric label={t("an.candidates")} value={o.incidents.transformation_candidates} />
          <Metric label={t("an.csat")} value={o.csat.responses > 0 ? `${o.csat.avg}★` : "—"} />
          <Metric label={t("an.satisfied")} value={o.csat.responses > 0 ? `${o.csat.satisfied_pct}%` : "—"} />
        </div>
      </div>

      {/* Tendencia + top categorias */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <Panel title={t("an.trend")}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, marginTop: 8 }}>
            {o.trend.map((d) => (
              <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div title={`${d.day}: ${d.count}`} style={{ width: "100%", height: `${(d.count / tmax) * 100}%`, minHeight: d.count > 0 ? 4 : 0, background: "var(--accent)", borderRadius: 3 }} />
                <div style={{ fontSize: 8.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{d.day.slice(8)}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>{t("an.trend.hint")}</div>
        </Panel>
        <Panel title={t("an.topcat")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {o.top_categories.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>—</div>}
            {o.top_categories.map((c) => {
              const max = Math.max(1, ...o.top_categories.map((x) => x.count));
              return (
                <div key={c.category} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "var(--text)", width: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.category}</span>
                  <div style={{ flex: 1, height: 8, background: "var(--paper)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(c.count / max) * 100}%`, height: "100%", background: "var(--accent-2)" }} /></div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", width: 20, textAlign: "right" }}>{c.count}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Resumen por modulo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ModuleCard title={t("nav.problems")} href="/problems" rows={[[t("an.open"), o.problems.open], [t("prob.knownerror"), o.problems.known_errors]]} />
        <ModuleCard title={t("nav.changes")} href="/changes" rows={[[t("an.open"), o.changes.open], [t("chg.kpi.pendingcab"), o.changes.pending_cab], [t("chg.kpi.emergency"), o.changes.emergency]]} />
        <ModuleCard title={t("nav.risk")} href="/risk" rows={[[t("an.open"), o.risk.open], [t("risk.kpi.estimated"), fmtMoney(o.risk.estimated)], [t("risk.kpi.actual"), fmtMoney(o.risk.actual)]]} />
        <ModuleCard title={t("nav.vendors")} href="/vendors" rows={[[t("an.active"), o.vendors.active], [t("vnd.kpi.critical"), o.vendors.critical]]} />
        <ModuleCard title={t("nav.workflows")} href="/workflows" rows={[[t("an.running"), o.workflows.running]]} />
        <ModuleCard title={t("nav.majorincidents")} href="/major-incidents" rows={[[t("an.active"), o.major_incidents.active], ["SEV1", o.major_incidents.sev1]]} />
      </div>
    </div>
  );
}

function Metric({ label, value, href, danger }: { label: string; value: number | string; href?: string; danger?: boolean }) {
  const inner = (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 14, height: "100%" }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 24, letterSpacing: "-1px", color: danger ? "var(--st-critical-fg)" : "var(--text)" }}>{value}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{inner}</Link> : inner;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</div>{children}</div>;
}
function ModuleCard({ title, href, rows }: { title: string; href: string; rows: [string, number | string][] }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 12 }}>{title}</div>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{k}</span>
            <span style={{ fontSize: 12.5, fontFamily: "var(--font-mono)", color: "var(--text)" }}>{v}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}
