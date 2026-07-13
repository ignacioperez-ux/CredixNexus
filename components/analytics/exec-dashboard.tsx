"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { Overview } from "@/lib/analytics/queries";
import { serviceHealth } from "@/lib/analytics/format";

const HEALTH_COLOR: Record<string, string> = { healthy: "var(--st-low-fg)", degraded: "var(--st-high-fg)", critical: "var(--st-critical-fg)" };

export function ExecDashboard({ o }: { o: Overview }) {
  const { t, locale } = useI18n();
  const health = serviceHealth({ p1Open: o.incidents.p1_open, slaBreached: o.incidents.sla_breached, sev1: o.major_incidents.sev1, unackEscalations: o.escalations.unack });
  const fmtMoney = (n: number) => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(n);
  const prio = [
    { key: "p1", label: "P1", value: o.incidents.p1_open, color: "var(--st-critical)" },
    { key: "p2", label: "P2", value: o.incidents.p2_open, color: "var(--st-high)" },
    { key: "p3", label: "P3", value: o.incidents.p3_open, color: "var(--st-medium)" },
    { key: "p4", label: "P4", value: o.incidents.p4_open, color: "var(--st-low)" },
  ];
  const prioTotal = prio.reduce((s, p) => s + p.value, 0);

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
          <AreaChart points={o.trend.map((d) => ({ label: d.day, value: d.count }))} />
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

      {/* Satisfaccion + distribucion por prioridad */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title={t("an.csat.panel")}>
          {o.csat.responses > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 8 }}>
              <Ring pct={o.csat.satisfied_pct} color="var(--st-low)" center={`${o.csat.satisfied_pct}%`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><span style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 600, color: "var(--st-low-fg)" }}>{o.csat.avg}</span> <span style={{ color: "var(--st-medium)" }}>★</span></div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{o.csat.responses} {t("an.responses")}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("an.satisfied")}</div>
              </div>
            </div>
          ) : <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>{t("an.noresp")}</div>}
        </Panel>
        <Panel title={t("an.byprio")}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 8 }}>
            <SegRing segs={prio.filter((p) => p.value > 0).map((p) => ({ value: p.value, color: p.color }))} center={String(prioTotal)} />
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {prio.map((p) => (
                <span key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text)" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                  {p.label} <b style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{p.value}</b>
                </span>
              ))}
            </div>
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
    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 6 }}>{title}</div>{children}</div>;
}

/** Anillo de progreso de un valor (0-100). Centro con el dato. */
function Ring({ pct, color, center }: { pct: number; color: string; center: string }) {
  const size = 96, stroke = 10, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18, color: "var(--text)" }}>{center}</div>
    </div>
  );
}

/** Anillo segmentado (distribucion). Centro con el total. */
function SegRing({ segs, center }: { segs: { value: number; color: string }[]; center: string }) {
  const size = 96, stroke = 10, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const total = Math.max(1, segs.reduce((s, x) => s + x.value, 0));
  let start = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {segs.map((s, i) => {
          const len = (s.value / total) * c;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-start} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
          start += len;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18, color: "var(--text)" }}>{center}</div>
    </div>
  );
}

/** Grafico de area: grid tenue + degradado + linea + endpoint enfatizado. Datos reales. */
function AreaChart({ points }: { points: { label: string; value: number }[] }) {
  if (points.length === 0) return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>—</div>;
  const W = 600, H = 150, pad = 8;
  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (i: number) => (points.length <= 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const last = points[points.length - 1];
  const grid = [0.25, 0.5, 0.75].map((g) => H - pad - g * (H - pad * 2));
  const lbl = (s: string) => s.length >= 10 ? s.slice(5) : s; // MM-DD
  return (
    <div style={{ marginTop: 4 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", height: "auto", overflow: "visible" }} role="img" aria-label="Tendencia">
        <defs><linearGradient id="cxarea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".26" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
        {grid.map((gy, i) => <line key={i} x1="0" y1={gy} x2={W} y2={gy} stroke="var(--line-soft)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <path d={area} fill="url(#cxarea)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r="4" fill="var(--accent)" />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r="8" fill="var(--accent-soft)" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
        <span>{lbl(points[0].label)}</span>
        {points.length > 2 && <span>{lbl(points[Math.floor(points.length / 2)].label)}</span>}
        <span style={{ color: "var(--accent-2)", fontWeight: 700 }}>{lbl(last.label)} · {last.value}</span>
      </div>
    </div>
  );
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
