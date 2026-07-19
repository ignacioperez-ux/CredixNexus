"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { OperationsTower as TowerData, OpsDecision, OpsPipelineStage, OpsKpis } from "@/lib/operations/queries";
import type { Overview, Supervisor } from "@/lib/analytics/queries";
import { KpiGrid, type DashboardCounts } from "@/components/dashboard/kpi-grid";

// Torre de Control de Operaciones (support_lead) UNIFICADA: absorbe las metricas del ex-dashboard
// ejecutivo. Decision primero (hero + bandeja priorizada), luego operacion (KPIs) y detalle en tabs
// (Resumen/Colas/Carga/SLA/Aging con deep-link ?tab=). Todo dato REAL del servidor; solo presentacion.
// Reutiliza queries existentes (getOperationsTower + getSupervisor + getOverview + dashboard_counts),
// sin duplicar logica. Tokens del design system (Nexus/Claro); numeros en mono, ceros atenuados.

const DECISION_META: Record<OpsDecision["kind"], { label: MessageKey; cta: MessageKey; icon: string }> = {
  mi_comm:    { label: "op.tw.d.mi",     cta: "op.tw.cta.warroom",   icon: "alert" },
  sla_breach: { label: "op.tw.d.sla",    cta: "op.tw.cta.intervene", icon: "flag" },
  intake:     { label: "op.tw.d.intake", cta: "op.tw.cta.admit",     icon: "inbox" },
  assign:     { label: "op.tw.d.assign", cta: "op.tw.cta.assign",    icon: "user" },
  derive:     { label: "op.tw.d.derive", cta: "op.tw.cta.derive",    icon: "zap" },
};

const AGING_COLOR: Record<string, string> = { "0-1d": "var(--st-low)", "1-3d": "var(--st-medium)", "3-7d": "var(--st-high)", "7d+": "var(--st-critical)" };
const FUNNEL: { key: string; color: string }[] = [
  { key: "triaged", color: "var(--st-info)" },
  { key: "assigned", color: "var(--st-info)" },
  { key: "in_progress", color: "var(--st-high)" },
  { key: "waiting", color: "var(--st-medium)" },
  { key: "reopened", color: "var(--st-critical)" },
  { key: "resolved", color: "var(--st-low)" },
];

type Tab = "resumen" | "colas" | "carga" | "sla" | "aging";
const TABS: Tab[] = ["resumen", "colas", "carga", "sla", "aging"];

export function OperationsTower({ tower, supervisor, overview, counts, firstName }: {
  tower: TowerData; supervisor: Supervisor; overview: Overview; counts: DashboardCounts; firstName: string;
}) {
  const { t, locale } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = sp.get("tab") ?? "resumen";
  const tab: Tab = (TABS as string[]).includes(tabParam) ? (tabParam as Tab) : "resumen";
  function setTab(v: Tab) {
    const params = new URLSearchParams(sp.toString());
    if (v === "resumen") params.delete("tab"); else params.set("tab", v);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Fecha/saludo se calculan en cliente (evita mismatch de hidratacion con la hora del server).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const greet = now
    ? t(now.getHours() < 12 ? "op.tw.greet.morning" : now.getHours() < 19 ? "op.tw.greet.afternoon" : "op.tw.greet.evening")
    : "";
  const dateStr = now ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now) : "";

  const { status, decisions, pipeline, kpis } = tower;
  const inc = overview.incidents;
  const inflow = overview.trend.map((d) => d.count);
  const today = inflow.at(-1) ?? 0;
  const delta = today - (inflow.at(-2) ?? 0);

  const tabLabels: Record<Tab, MessageKey> = {
    resumen: "op.tw.tab.resumen", colas: "op.tw.tab.colas", carga: "op.tw.tab.carga", sla: "op.tw.tab.sla", aging: "op.tw.tab.aging",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1180 }}>
      {/* A) HERO COMPACTO */}
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>
            {t("nav.op.torre")}{dateStr ? ` · ${dateStr}` : ""}
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.02em" }}>
            {greet ? `${greet}, ${firstName}` : firstName}
          </h1>
        </div>
        <StatusChips status={status} t={t} />
      </header>

      {/* B) REQUIERE TU DECISION (rejilla 2x2) */}
      <section style={card()}>
        <SectionTitle icon="flag" title={t("op.tw.decide.title")} count={decisions.length} />
        {decisions.length === 0 ? (
          <EmptyState text={t("op.tw.decide.empty")} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 10 }}>
            {decisions.map((d) => <DecisionRow key={d.kind} d={d} t={t} />)}
          </div>
        )}
      </section>

      {/* C) FRANJA OPERACION (4 KPIs del ex-dashboard, misma fuente) */}
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>{t("dash.ops")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
          {/* Fuentes UNIFICADAS para no mostrar el mismo concepto con numeros distintos (integridad §10):
              backlog = tower.kpis.backlogOpen (== tab SLA); sin asignar = status.unassigned (== hero);
              SLA incumplido = status.slaBreached (== hero). El sparkline/hoy es tendencia de INGRESO
              (overview.trend), concepto distinto del backlog; resueltos 30d y % reapertura son unicos. */}
          <Kpi label={t("dash.backlog")} value={kpis.backlogOpen}
            sub={<span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: delta > 0 ? "var(--st-critical-fg)" : delta < 0 ? "var(--st-low-fg)" : "var(--muted)" }}>
              {delta !== 0 && <Icon name={delta > 0 ? "chevron-up" : "chevron-down"} size={12} />}{today} {t("dash.today")}</span>}
            spark={inflow} />
          <Kpi label={t("dash.unassigned")} value={status.unassigned} color={status.unassigned > 0 ? "var(--st-high-fg)" : undefined} sub={<span style={{ color: "var(--muted)" }}>{t("dash.totake")}</span>} href="/incidents?view=unassigned" />
          <Kpi label={t("dash.slabreach")} value={status.slaBreached} color={status.slaBreached > 0 ? "var(--st-critical-fg)" : "var(--st-low-fg)"} sub={<span style={{ color: "var(--muted)" }}>{t("dash.overdue")}</span>} href="/incidents?view=sla" />
          <Kpi label={t("dash.resolved30")} value={inc.resolved_30d} color="var(--st-low-fg)" sub={<span style={{ color: "var(--muted)" }}>{supervisor.quality.reopen_rate}% {t("dash.reopen")}</span>} />
        </div>
      </section>

      {/* D) TABS con deep-link ?tab= */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)" }}>
        {TABS.map((k) => {
          const active = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)}
              style={{ fontSize: 13, fontWeight: 600, padding: "10px 16px", border: "none", background: active ? "var(--card)" : "transparent", color: active ? "var(--text)" : "var(--muted)", cursor: "pointer", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1, borderRadius: "7px 7px 0 0" }}>
              {t(tabLabels[k])}
            </button>
          );
        })}
      </div>

      {/* 1) RESUMEN: pipeline + inventario */}
      {tab === "resumen" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section style={card()}>
            <SectionTitle icon="activity" title={t("op.tw.pipeline.title")} />
            <Pipeline stages={pipeline} t={t} />
          </section>
          <section style={card()}>
            <SectionTitle icon="layers" title={t("dash.inventory")} />
            <KpiGrid counts={counts} />
          </section>
        </div>
      )}

      {/* 2) COLAS: embudo por estado (supervisor.by_status) */}
      {tab === "colas" && (
        <Panel title={t("dash.funnel")}>
          <Funnel supervisor={supervisor} t={t} />
        </Panel>
      )}

      {/* 3) CARGA: por operador (supervisor.workload) */}
      {tab === "carga" && (
        <Panel title={t("dash.workload")}>
          <Workload supervisor={supervisor} t={t} />
        </Panel>
      )}

      {/* 4) SLA: indicadores ITSM (tower.kpis) */}
      {tab === "sla" && (
        <section style={card()}>
          <SectionTitle icon="scale" title={t("op.tw.kpis.title")} />
          <Kpis kpis={kpis} t={t} />
        </section>
      )}

      {/* 5) AGING: antiguedad del backlog (supervisor.aging) */}
      {tab === "aging" && (
        <Panel title={t("dash.aging")}>
          <Aging supervisor={supervisor} t={t} />
        </Panel>
      )}
    </div>
  );
}

function StatusChips({ status, t }: { status: TowerData["status"]; t: (k: MessageKey) => string }) {
  const chips: { n: number; label: MessageKey; tone: "amber" | "indigo" | "red" }[] = [
    { n: status.pendingIntake, label: "op.tw.status.pendingIntake", tone: "amber" },
    { n: status.unassigned, label: "op.tw.status.unassigned", tone: "indigo" },
    { n: status.slaBreached, label: "op.tw.status.slaBreached", tone: "red" },
    { n: status.miCommOverdue, label: "op.tw.status.miOverdue", tone: "red" },
  ];
  const tones: Record<string, { fg: string; bg: string }> = {
    amber: { fg: "var(--st-high-fg)", bg: "var(--st-high-bg)" },
    indigo: { fg: "var(--st-info-fg, var(--accent-2))", bg: "var(--st-info-bg, var(--paper))" },
    red: { fg: "var(--st-critical-fg)", bg: "var(--st-critical-bg)" },
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {chips.map((c, i) => {
        const zero = c.n === 0;
        const tn = tones[c.tone];
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20, background: zero ? "var(--head-bg)" : tn.bg, border: `1px solid ${zero ? "var(--line)" : "transparent"}`, opacity: zero ? 0.55 : 1 }}>
            <b style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 800, color: zero ? "var(--muted)" : tn.fg }}>{c.n}</b>
            <span style={{ fontSize: 11.5, color: zero ? "var(--muted)" : "var(--text)" }}>{t(c.label)}</span>
          </span>
        );
      })}
    </div>
  );
}

function DecisionRow({ d, t }: { d: OpsDecision; t: (k: MessageKey) => string }) {
  const meta = DECISION_META[d.kind];
  const red = d.severity === "red";
  const bg = red ? "var(--st-critical-bg)" : "var(--st-high-bg)";
  const fg = red ? "var(--st-critical-fg)" : "var(--st-high-fg)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: bg, border: `1px solid ${fg}22` }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "var(--card)", color: fg, flexShrink: 0 }}>
        <Icon name={meta.icon} size={16} color={fg} />
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 18, fontWeight: 800, color: fg, minWidth: 30, textAlign: "right" }}>{d.count}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(meta.label)}</div>
        {d.oldestDays != null && d.oldestDays > 0 && (
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{t("op.tw.oldest")}: {d.oldestDays} d</div>
        )}
      </div>
      <Link href={d.link} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, background: red ? "var(--accent)" : "var(--card)", color: red ? "var(--on-accent)" : fg, border: red ? "none" : `1px solid ${fg}55`, fontSize: 12.5, fontWeight: 700, textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" }}>
        {t(meta.cta)}
        <Icon name="chevron-right" size={13} color={red ? "var(--on-accent)" : fg} />
      </Link>
    </div>
  );
}

function Pipeline({ stages, t }: { stages: OpsPipelineStage[]; t: (k: MessageKey) => string }) {
  const link = (key: string) => (key === "in_evolution" ? "/casos-convertidos" : `/incidents?status=${key}`);
  const total = stages.reduce((n, s) => n + s.count, 0);
  const max = Math.max(1, ...stages.map((s) => s.count));
  const ageColor = (d: number) => (d >= 90 ? "var(--st-critical-fg)" : d >= 30 ? "var(--st-high-fg)" : "var(--muted)");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 2 }}>{t("op.tw.pipeline.total")}: <b style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{total}</b></div>
      {stages.map((s) => {
        const evo = s.key === "in_evolution";
        return (
          <Link key={s.key} href={link(s.key)}
            style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", padding: "4px 6px", margin: "0 -6px", borderRadius: "var(--r-sm)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--row-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <span style={{ fontSize: 12, color: evo ? "var(--teal)" : "var(--text)", width: 110, flexShrink: 0, fontWeight: evo ? 700 : 500 }}>{t(`op.tw.st.${s.key}` as MessageKey)}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 20, background: "var(--track)", overflow: "hidden" }}>
              <div style={{ width: `${(s.count / max) * 100}%`, height: "100%", background: evo ? "var(--teal)" : "var(--accent-2)", borderRadius: 20 }} />
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 12.5, color: s.count === 0 ? "var(--muted)" : "var(--text)", width: 34, textAlign: "right", opacity: s.count === 0 ? 0.5 : 1 }}>{s.count}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: ageColor(s.maxAgeDays), width: 66, textAlign: "right", opacity: s.maxAgeDays > 0 ? 1 : 0 }}>{t("op.tw.maxage")} {s.maxAgeDays}d</span>
          </Link>
        );
      })}
    </div>
  );
}

function Funnel({ supervisor, t }: { supervisor: Supervisor; t: (k: MessageKey) => string }) {
  const funnel = FUNNEL.map((f) => ({ ...f, n: supervisor.by_status[f.key] ?? 0 })).filter((f) => f.n > 0);
  const max = Math.max(1, ...funnel.map((f) => f.n));
  if (funnel.length === 0) return <Empty text={t("dash.opsempty")} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
      {funnel.map((f) => (
        <RowLink key={f.key} href={`/incidents?status=${f.key}`}>
          <span style={{ fontSize: 12, color: "var(--text)", width: 90, flexShrink: 0 }}>{t(("st." + f.key) as MessageKey)}</span>
          <div style={{ flex: 1, height: 8, borderRadius: 20, background: "var(--track)", overflow: "hidden" }}>
            <div style={{ width: `${(f.n / max) * 100}%`, height: "100%", background: f.color, borderRadius: 20 }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", width: 30, textAlign: "right" }}>{f.n}</span>
        </RowLink>
      ))}
    </div>
  );
}

function Workload({ supervisor, t }: { supervisor: Supervisor; t: (k: MessageKey) => string }) {
  const workload = supervisor.workload.slice(0, 12);
  const max = Math.max(1, ...workload.map((w) => w.open));
  if (workload.length === 0) return <Empty text={t("dash.opsempty")} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, paddingTop: 4 }}>
      {workload.map((w) => (
        <RowLink key={w.agent} href={`/incidents?assignee=${encodeURIComponent(w.agent)}`}>
          <span style={{ fontSize: 12.5, color: "var(--text)", width: 150, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.agent}</span>
          <div style={{ flex: 1, height: 8, borderRadius: 20, background: "var(--track)", overflow: "hidden" }}>
            <div style={{ width: `${(w.open / max) * 100}%`, height: "100%", background: "var(--accent-2)", borderRadius: 20 }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", width: 26, textAlign: "right" }}>{w.open}</span>
          {w.overdue > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--st-critical-fg)", width: 62 }}>{w.overdue} {t("dash.overdue")}</span>}
        </RowLink>
      ))}
    </div>
  );
}

function Aging({ supervisor, t }: { supervisor: Supervisor; t: (k: MessageKey) => string }) {
  const max = Math.max(1, ...supervisor.aging.map((a) => a.count));
  if (supervisor.open === 0) return <Empty text={t("dash.opsempty")} />;
  const over7 = supervisor.aging.find((a) => a.bucket === "7d+")?.count ?? 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {over7 > 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("dash.aging.over7a")} <b style={{ fontFamily: "var(--font-mono)", color: "var(--st-critical-fg)" }}>{over7}</b> {t("dash.aging.over7b")}</div>}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 140, paddingTop: 8 }}>
        {supervisor.aging.map((a) => (
          <div key={a.bucket} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: AGING_COLOR[a.bucket] }}>{a.count}</span>
            <div style={{ width: "100%", maxWidth: 56, height: `${Math.max(4, (a.count / max) * 100)}px`, background: AGING_COLOR[a.bucket], borderRadius: "5px 5px 0 0" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)" }}>{a.bucket}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpis({ kpis, t }: { kpis: OpsKpis; t: (k: MessageKey) => string }) {
  const pct = (v: number | null) => (v == null ? "—" : `${v}%`);
  const items: { label: MessageKey; def: MessageKey; value: string; tone: "good" | "warn" | "bad" | "neutral" }[] = [
    { label: "op.tw.k.sla", def: "op.tw.k.sla.def", value: pct(kpis.slaCompliancePct), tone: kpis.slaCompliancePct == null ? "neutral" : kpis.slaCompliancePct >= 90 ? "good" : kpis.slaCompliancePct >= 75 ? "warn" : "bad" },
    { label: "op.tw.k.backlog", def: "op.tw.k.backlog.def", value: String(kpis.backlogOpen), tone: "neutral" },
    { label: "op.tw.k.unassigned", def: "op.tw.k.unassigned.def", value: pct(kpis.unassignedPct), tone: kpis.unassignedPct == null ? "neutral" : kpis.unassignedPct > 30 ? "bad" : kpis.unassignedPct > 10 ? "warn" : "good" },
    { label: "op.tw.k.mttr", def: "op.tw.k.mttr.def", value: kpis.mttrHours == null ? "—" : `${kpis.mttrHours} h`, tone: "neutral" },
    { label: "op.tw.k.csat", def: "op.tw.k.csat.def", value: kpis.csat == null ? "—" : String(kpis.csat), tone: kpis.csat == null ? "neutral" : kpis.csat >= 4 ? "good" : kpis.csat >= 3 ? "warn" : "bad" },
  ];
  const toneColor = (tone: string) => tone === "good" ? "var(--st-low-fg)" : tone === "warn" ? "var(--st-high-fg)" : tone === "bad" ? "var(--st-critical-fg)" : "var(--text)";
  return (
    // Indicadores ITSM SIEMPRE en una sola fila (5 columnas iguales; minmax(0,1fr) evita desborde).
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
      {items.map((k) => (
        <div key={k.label} title={t(k.def)} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 10, background: "var(--head-bg)", border: "1px solid color-mix(in srgb, var(--line) 60%, transparent)" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(k.label)}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 26, fontWeight: 800, lineHeight: 1, color: toneColor(k.tone) }}>{k.value}</span>
        </div>
      ))}
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
  return href ? <Link href={href} className="cx-lift" style={style}>{body}</Link> : <div style={style}>{body}</div>;
}

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

function SectionTitle({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <Icon name={icon} size={16} color="var(--accent)" />
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>{title}</h2>
      {count != null && count > 0 && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", borderRadius: 20, padding: "1px 8px" }}>{count}</span>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 12px", color: "var(--st-low-fg)", fontSize: 13 }}>
      <Icon name="check" size={16} color="var(--st-low-fg)" />
      {text}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 10px", color: "var(--muted)" }}>
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .7 }}><path d="M20 6 9 17l-5-5" /></svg>
    <span style={{ fontSize: 12.5 }}>{text}</span>
  </div>;
}

function card(): React.CSSProperties {
  return { background: "var(--card)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--sh-card)", border: "1px solid color-mix(in srgb, var(--line) 50%, transparent)" };
}
