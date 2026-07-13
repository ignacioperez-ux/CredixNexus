"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { Overview, Supervisor } from "@/lib/analytics/queries";
import { Icon } from "@/components/ui/icon";
import { KpiGrid, type DashboardCounts } from "./kpi-grid";

// Command Center operativo: resumen antes que detalle. Todo dato es real (RPC supervisor_metrics
// + analytics_overview); nada mockeado. El estado se codifica en color; el dato va en mono.

const AGING_COLOR: Record<string, string> = { "0-1d": "var(--st-low)", "1-3d": "var(--st-medium)", "3-7d": "var(--st-high)", "7d+": "var(--st-critical)" };
const FUNNEL: { key: string; color: string }[] = [
  { key: "triaged", color: "var(--st-info)" },
  { key: "assigned", color: "var(--st-info)" },
  { key: "in_progress", color: "var(--st-high)" },
  { key: "waiting", color: "var(--st-medium)" },
  { key: "reopened", color: "var(--st-critical)" },
  { key: "resolved", color: "var(--st-low)" },
];

type Tab = "resumen" | "colas" | "carga" | "sla";

export function CommandCenter({ overview, supervisor, counts }: { overview: Overview; supervisor: Supervisor; counts: DashboardCounts }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("resumen");
  const inc = overview.incidents;
  const inflow = overview.trend.map((d) => d.count);
  const today = inflow.at(-1) ?? 0;
  const delta = today - (inflow.at(-2) ?? 0);

  const agingMax = Math.max(1, ...supervisor.aging.map((a) => a.count));
  const funnel = FUNNEL.map((f) => ({ ...f, n: supervisor.by_status[f.key] ?? 0 })).filter((f) => f.n > 0);
  const funnelMax = Math.max(1, ...funnel.map((f) => f.n));
  const workload = supervisor.workload.slice(0, 8);
  const wlMax = Math.max(1, ...workload.map((w) => w.open));

  const tabs: { key: Tab; label: MessageKey }[] = [
    { key: "resumen", label: "dash.tab.summary" },
    { key: "colas", label: "dash.tab.queues" },
    { key: "carga", label: "dash.tab.load" },
    { key: "sla", label: "dash.tab.sla" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>{t("dash.ops")}</div>

      {/* KPIs operativos persistentes (contexto en todas las pestanas) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <Kpi label={t("dash.backlog")} value={supervisor.open}
          sub={<span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: delta > 0 ? "var(--st-critical-fg)" : delta < 0 ? "var(--st-low-fg)" : "var(--muted)" }}>
            {delta !== 0 && <Icon name={delta > 0 ? "chevron-up" : "chevron-down"} size={12} />}{today} {t("dash.today")}</span>}
          spark={inflow} />
        <Kpi label={t("dash.unassigned")} value={supervisor.unassigned} color={supervisor.unassigned > 0 ? "var(--st-high-fg)" : undefined} sub={<span className="mut">{t("dash.totake")}</span>} href="/incidents?view=unassigned" />
        <Kpi label={t("dash.slabreach")} value={inc.sla_breached} color={inc.sla_breached > 0 ? "var(--st-critical-fg)" : "var(--st-low-fg)"} sub={<span className="mut">{supervisor.overdue} {t("dash.overdue")}</span>} href="/incidents?view=sla" />
        <Kpi label={t("dash.resolved30")} value={inc.resolved_30d} color="var(--st-low-fg)" sub={<span className="mut">{supervisor.quality.reopen_rate}% {t("dash.reopen")}</span>} />
      </div>

      {/* Pestanas del Command Center */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)" }}>
        {tabs.map((x) => {
          const active = tab === x.key;
          return (
            <button key={x.key} onClick={() => setTab(x.key)}
              style={{ fontSize: 13, fontWeight: 600, padding: "10px 16px", border: "none", background: "transparent", color: active ? "var(--text)" : "var(--muted)", cursor: "pointer", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1 }}>
              {t(x.label)}
            </button>
          );
        })}
      </div>

      {/* Resumen: inventario de plataforma */}
      {tab === "resumen" && <KpiGrid counts={counts} />}

      {/* Colas: incidentes por estado (embudo) */}
      {tab === "colas" && (
        <Panel title={t("dash.funnel")}>
          {funnel.length === 0 ? <Empty text={t("dash.opsempty")} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
              {funnel.map((f) => (
                <RowLink key={f.key} href={`/incidents?status=${f.key}`}>
                  <span style={{ fontSize: 12, color: "var(--text)", width: 90, flexShrink: 0 }}>{t(("st." + f.key) as MessageKey)}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 20, background: "var(--track)", overflow: "hidden" }}>
                    <div style={{ width: `${(f.n / funnelMax) * 100}%`, height: "100%", background: f.color, borderRadius: 20 }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", width: 30, textAlign: "right" }}>{f.n}</span>
                </RowLink>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Carga: por agente (quien esta sobrecargado) */}
      {tab === "carga" && (
        <Panel title={t("dash.workload")}>
          {workload.length === 0 ? <Empty text={t("dash.opsempty")} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9, paddingTop: 4 }}>
              {workload.map((w) => (
                <RowLink key={w.agent} href={`/incidents?assignee=${encodeURIComponent(w.agent)}`}>
                  <span style={{ fontSize: 12.5, color: "var(--text)", width: 130, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.agent}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 20, background: "var(--track)", overflow: "hidden" }}>
                    <div style={{ width: `${(w.open / wlMax) * 100}%`, height: "100%", background: "var(--accent-2)", borderRadius: 20 }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", width: 26, textAlign: "right" }}>{w.open}</span>
                  {w.overdue > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--st-critical-fg)", width: 60 }}>{w.overdue} {t("dash.overdue")}</span>}
                </RowLink>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* SLA & aging: antiguedad del backlog abierto */}
      {tab === "sla" && (
        <Panel title={t("dash.aging")}>
          {supervisor.open === 0 ? <Empty text={t("dash.opsempty")} /> : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 140, paddingTop: 8 }}>
              {supervisor.aging.map((a) => (
                <div key={a.bucket} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: AGING_COLOR[a.bucket] }}>{a.count}</span>
                  <div style={{ width: "100%", maxWidth: 56, height: `${Math.max(4, (a.count / agingMax) * 100)}px`, background: AGING_COLOR[a.bucket], borderRadius: "5px 5px 0 0" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)" }}>{a.bucket}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function Kpi({ label, value, color, sub, spark, href }: { label: string; value: number; color?: string; sub?: React.ReactNode; spark?: number[]; href?: string }) {
  const body = (
    <>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 30, letterSpacing: "-1.5px", color: color ?? "var(--text)", marginTop: 8 }}>{value.toLocaleString()}</div>
      {sub && <div style={{ fontSize: 11.5, marginTop: 3, fontWeight: 600 }}>{sub}</div>}
      {spark && spark.some((n) => n > 0) && <div style={{ marginTop: 10 }}><Spark data={spark} /></div>}
    </>
  );
  const style: React.CSSProperties = { display: "block", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16, position: "relative", overflow: "hidden", textDecoration: "none" };
  return href
    ? <Link href={href} className="cx-lift" style={style}>{body}</Link>
    : <div style={style}>{body}</div>;
}

/** Sparkline SVG del inflow real (area + linea + endpoint). */
function Spark({ data }: { data: number[] }) {
  const w = 150, h = 30, max = Math.max(1, ...data);
  const pts = data.map((n, i) => [(i / Math.max(1, data.length - 1)) * w, h - (n / max) * (h - 3) - 1.5]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden style={{ display: "block" }}>
      <path d={area} fill="var(--accent-soft)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill="var(--accent)" />
    </svg>
  );
}

/** Fila-metrica clicable: drill accionable a la lista de incidentes ya filtrada. */
function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit", padding: "4px 6px", margin: "0 -6px", borderRadius: "var(--r-sm)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--row-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      {children}
    </Link>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10, color: "var(--text)" }}>{title}</div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 10px", color: "var(--muted)" }}>
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .7 }}><path d="M20 6 9 17l-5-5" /></svg>
    <span style={{ fontSize: 12.5 }}>{text}</span>
  </div>;
}
