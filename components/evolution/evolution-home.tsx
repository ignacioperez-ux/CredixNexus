"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { EvolutionHome as HomeData, DecisionItem, DecisionKind, FunnelStage } from "@/lib/evolution/queries";
import type { TribeLoad } from "@/lib/projects/portfolio";
import { ConceptTip } from "@/components/help/concept-tip";
import { Icon } from "@/components/ui/icon";

type Roi = { estRoi: number | null; realRoi: number | null; measured: number; total: number };
type TrendPoint = { week: string; count: number };

// Torre de Control (cockpit del Gerente de Evolucion). Orden de lectura: (1) que espera MI
// decision hoy, (2) donde esta el riesgo, (3) fluye el sistema. Accionable arriba, informativo
// abajo. Todo dato real: RPC evolution_home + evolution_decisions + portafolio + behavior.

function interp(s: string, m: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(m[k] ?? ""));
}

const DECISION_META: Record<DecisionKind, { title: MessageKey; btn: MessageKey }> = {
  mi_comm: { title: "tc.mi.title", btn: "tc.mi.btn" },
  cab: { title: "tc.cab.title", btn: "tc.cab.btn" },
  convert: { title: "tc.convert.title", btn: "tc.convert.btn" },
  signal: { title: "tc.signal.title", btn: "tc.signal.btn" },
  roi: { title: "tc.roi.title", btn: "tc.roi.btn" },
  kb: { title: "tc.kb.title", btn: "tc.kb.btn" },
};

const PIPELINE: { key: FunnelStage; label: MessageKey; href: string; tip?: string }[] = [
  { key: "candidates", label: "evh.funnel.candidates", href: "/casos-convertidos", tip: "case" },
  { key: "rec_pending", label: "evh.funnel.recPending", href: "/projects" },
  { key: "rec_approved", label: "evh.funnel.recApproved", href: "/projects" },
  { key: "in_evolution", label: "evh.funnel.inEvolution", href: "/casos-convertidos" },
  { key: "proj_active", label: "evh.funnel.active", href: "/projects", tip: "initiative" },
  { key: "proj_done", label: "evh.funnel.done", href: "/projects/portafolio" },
];

export function EvolutionHome({ home, decisions, roi, tribes, trend, projection, firstName }: {
  home: HomeData; decisions: DecisionItem[]; roi: Roi; tribes: TribeLoad[];
  trend: TrendPoint[]; projection: number | null; firstName: string;
}) {
  const { t, locale } = useI18n();
  const f = home.funnel;
  const ag = home.aging;
  const tribesOver = tribes.filter((tr) => tr.over).length;

  // Saludo + fecha larga + linea de estado calculada.
  const hour = new Date().getHours();
  const greet = hour < 12 ? t("tc.greet.morning") : hour < 19 ? t("tc.greet.afternoon") : t("tc.greet.evening");
  const longDate = new Date().toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const statusParts: string[] = [];
  if (decisions.length > 0) statusParts.push(`${decisions.length} ${t(decisions.length === 1 ? "tc.status.decision" : "tc.status.decisions")}`);
  if (tribesOver > 0) statusParts.push(`${tribesOver} ${t(tribesOver === 1 ? "tc.status.tribeOver" : "tc.status.tribesOver")}`);
  if (home.signals > 0) statusParts.push(`${home.signals} ${t(home.signals === 1 ? "tc.status.signal" : "tc.status.signals")}`);
  const statusLine = statusParts.length ? statusParts.join(" · ") : t("tc.status.none");
  const allClear = statusParts.length === 0;

  const numFont = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* §0 Saludo + estado */}
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 12px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "var(--text)", margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
          {greet}, {firstName} <ConceptTip concept="initiative" />
        </h1>
        <span style={{ fontSize: 12.5, color: "var(--muted)", textTransform: "capitalize" }}>{longDate}</span>
        <div style={{ flexBasis: "100%", height: 0 }} />
        <span style={{ fontSize: 13, color: allClear ? "var(--st-low-fg)" : "var(--text)", fontWeight: 600 }}>{statusLine}</span>
      </header>

      {/* §1 Requiere tu decision (bandeja de accion) — lo mas importante */}
      <section style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-card)", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ ...numFont, fontSize: 40, fontWeight: 500, lineHeight: 1, letterSpacing: "-1.5px", color: decisions.length ? "var(--accent)" : "var(--muted)" }}>{decisions.length}</span>
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)", margin: 0 }}>{t("tc.decisions.title")}</h2>
            <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "2px 0 0" }}>{t("tc.decisions.hint")}</p>
          </div>
        </div>

        {decisions.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)", padding: "16px 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="check" size={15} color="var(--st-low-fg)" /> {t("tc.decisions.empty")}
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {decisions.map((d, i) => <DecisionRow key={`${d.kind}-${d.entity_id ?? i}`} d={d} t={t} />)}
          </ul>
        )}
      </section>

      {/* §2 Pipeline: de la incidencia a la entrega */}
      <Panel title={t("tc.pipeline.title")} hint={t("tc.pipeline.hint")}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginTop: 12, overflowX: "auto", paddingBottom: 2 }}>
          {PIPELINE.map((s, i) => {
            const age = ag[s.key] ?? 0;
            const val = f[s.key] ?? 0;
            return (
              <div key={s.key} style={{ display: "flex", alignItems: "stretch", flex: "1 1 140px", minWidth: 140 }}>
                <Link href={s.href} className="cx-lift" style={{ flex: 1, textDecoration: "none", background: "var(--card-2, var(--paper))", border: "1px solid var(--line)", borderLeft: i === 0 ? "1px solid var(--line)" : "none", padding: "12px 14px", borderRadius: i === 0 ? "var(--r-lg) 0 0 var(--r-lg)" : i === PIPELINE.length - 1 ? "0 var(--r-lg) var(--r-lg) 0" : 0, display: "block" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px" }}>{t(s.label)}</span>
                    {s.tip && <ConceptTip concept={s.tip} size={12} />}
                  </div>
                  <div style={{ ...numFont, fontSize: 34, fontWeight: 500, letterSpacing: "-1.5px", color: "var(--text)", marginTop: 2, lineHeight: 1.05 }}>{val}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{val > 0 && age > 0 ? interp(t("tc.pipeline.aging"), { n: age }) : t("tc.pipeline.fresh")}</div>
                </Link>
                {i < PIPELINE.length - 1 && (
                  <div style={{ display: "flex", alignItems: "center", margin: "0 -6px", zIndex: 1 }}>
                    <Icon name="chevron-right" size={14} color="var(--muted)" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* §3 Riesgo y valor */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, alignItems: "start" }}>
        <HealthModule home={home} t={t} />
        <CapacityModule tribes={tribes} t={t} numFont={numFont} />
        <ValueModule roi={roi} t={t} numFont={numFont} />
      </div>

      {/* §4 Tendencia */}
      <Panel title={t("tc.trend.title")} hint={t("tc.trend.hint")}>
        <Sparkline trend={trend} projection={projection} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
            {projection != null && (<>{t("tc.trend.proj")}: <b style={{ ...numFont, color: "var(--text)" }}>{projection}</b></>)}
          </span>
          <Link href="/analytics/comportamiento" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-2)", textDecoration: "none" }}>{t("tc.trend.link")} →</Link>
        </div>
      </Panel>

      {/* §5 Accesos rapidos */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Chip href="/projects/portafolio" label={t("nav.portfolio")} />
        <Chip href="/evolucion/mapa" label={t("nav.tribemap")} />
        <Chip href="/analytics/comportamiento" label={t("beh.title")} />
        <Chip href="/casos-convertidos" label={t("cc.title")} />
      </div>
    </div>
  );
}

function DecisionRow({ d, t }: { d: DecisionItem; t: (k: MessageKey) => string }) {
  const meta = DECISION_META[d.kind];
  const bg = d.severity === "red" ? "var(--st-critical-bg)" : "var(--st-high-bg)";
  const bar = d.severity === "red" ? "var(--st-critical)" : "var(--st-high)";
  const fg = d.severity === "red" ? "var(--st-critical-fg)" : "var(--st-high-fg)";
  const isCount = d.kind === "signal" || d.kind === "kb";
  const ageStr = d.age_days != null ? (d.age_days <= 0 ? t("tc.age.today") : d.age_days === 1 ? t("tc.age.day") : interp(t("tc.age.days"), { n: d.age_days })) : null;
  const sub = isCount
    ? interp(t(d.kind === "signal" ? "tc.signal.count" : "tc.kb.count"), { n: d.count ?? 0 })
    : d.title ?? "";

  return (
    <li style={{ display: "flex", alignItems: "center", gap: 12, background: bg, borderRadius: "var(--r-lg)", padding: "11px 14px", position: "relative", overflow: "hidden" }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: bar }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3px", color: fg }}>{t(meta.title)}</span>
          {d.code && <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 10.5, color: "var(--muted)" }}>{d.code}</span>}
          {ageStr && !isCount && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>· {ageStr}</span>}
        </div>
        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
      </div>
      <Link href={d.link} className="cx-lift" style={{ flexShrink: 0, textDecoration: "none", background: "var(--accent)", color: "var(--on-accent, #fff)", fontSize: 12, fontWeight: 700, padding: "7px 13px", borderRadius: 8, whiteSpace: "nowrap" }}>{t(meta.btn)}</Link>
    </li>
  );
}

function HealthModule({ home, t }: { home: HomeData; t: (k: MessageKey) => string }) {
  const [open, setOpen] = useState(false);
  const h = home.health;
  const total = (h.blocked ?? 0) + (h.at_risk ?? 0);
  return (
    <Panel title={t("tc.risk.title")}>
      {total === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>{t("tc.risk.empty")}</div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatChip label={t("tc.risk.blocked")} value={h.blocked ?? 0} tone={(h.blocked ?? 0) > 0 ? "crit" : "muted"} />
            <StatChip label={t("tc.risk.atrisk")} value={h.at_risk ?? 0} tone={(h.at_risk ?? 0) > 0 ? "warn" : "muted"} />
            {h.items.length > 0 && (
              <button onClick={() => setOpen((o) => !o)} style={{ marginLeft: "auto", background: "transparent", border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--muted)", padding: "4px 9px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name={open ? "chevron-down" : "chevron-right"} size={12} color="var(--muted)" /> {h.items.length}
              </button>
            )}
          </div>
          {open && (
            <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {h.items.map((it) => (
                <li key={it.id}>
                  <Link href={`/projects/${it.id}`} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", fontSize: 12.5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: it.kind === "blocked" ? "var(--st-critical)" : "var(--st-high)", flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 10.5, color: "var(--muted)" }}>{it.code}</span>
                    <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

function CapacityModule({ tribes, t, numFont }: { tribes: TribeLoad[]; t: (k: MessageKey) => string; numFont: React.CSSProperties }) {
  const rows = tribes.filter((tr) => tr.squads > 0).slice(0, 5);
  return (
    <Panel title={t("tc.cap.title")}>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>{t("tc.cap.empty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {rows.map((tr) => {
            const pct = tr.loadPct ?? 0;
            const col = capColor(tr.loadPct);
            return (
              <Link key={tr.id} href={`/projects/portafolio?tribe=${tr.id}`} style={{ textDecoration: "none", display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <span style={{ color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tr.name}</span>
                  <span style={{ ...numFont, fontSize: 11.5, color: col, flexShrink: 0 }}>{tr.committed}/{tr.capacity}{tr.loadPct != null ? ` · ${tr.loadPct}%` : ""}</span>
                </div>
                <div style={{ height: 7, background: "var(--track)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: col, borderRadius: 4 }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function ValueModule({ roi, t, numFont }: { roi: Roi; t: (k: MessageKey) => string; numFont: React.CSSProperties }) {
  const debt = roi.total > 0 && roi.measured < roi.total;
  return (
    <Panel title={t("tc.value.title")}>
      <div style={{ display: "flex", gap: 22, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4 }}>{t("tc.value.est")}</div>
          <div style={{ ...numFont, fontSize: 24, fontWeight: 500, letterSpacing: "-1px", color: "var(--text)" }}>{roi.estRoi != null ? `${roi.estRoi}%` : "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4 }}>{t("tc.value.real")}</div>
          <div style={{ ...numFont, fontSize: 24, fontWeight: 500, letterSpacing: "-1px", color: roi.realRoi != null ? "var(--text)" : "var(--muted)" }}>{roi.realRoi != null ? `${roi.realRoi}%` : "—"}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: debt ? "var(--st-high-fg)" : "var(--muted)", marginTop: 10 }}>
        {interp(t("tc.value.measured"), { m: roi.measured, n: roi.total })}
        {debt && <div style={{ marginTop: 2 }}>{t("tc.value.debt")}</div>}
      </div>
    </Panel>
  );
}

function Sparkline({ trend, projection }: { trend: TrendPoint[]; projection: number | null }) {
  if (trend.length < 2) return <div style={{ fontSize: 12, color: "var(--muted)", padding: "20px 0" }}>—</div>;
  const W = 100, H = 34, pad = 3;
  const counts = trend.map((p) => p.count);
  const all = projection != null ? [...counts, projection] : counts;
  const max = Math.max(1, ...all);
  const denom = projection != null ? trend.length : trend.length - 1;
  const x = (i: number) => pad + (i / denom) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = counts.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(c).toFixed(2)}`).join(" ");
  const area = `${line} L${x(counts.length - 1).toFixed(2)},${H - pad} L${x(0).toFixed(2)},${H - pad} Z`;
  const lastX = x(counts.length - 1), lastY = y(counts[counts.length - 1]);
  const projX = projection != null ? x(trend.length) : null;
  const projY = projection != null ? y(projection) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 60, marginTop: 12, display: "block" }} role="img">
      <path d={area} fill="var(--accent)" opacity={0.1} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {projX != null && projY != null && (
        <>
          <path d={`M${lastX.toFixed(2)},${lastY.toFixed(2)} L${projX.toFixed(2)},${projY.toFixed(2)}`} fill="none" stroke="var(--accent)" strokeWidth={1.2} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" opacity={0.7} />
          <circle cx={projX} cy={projY} r={1.8} fill="var(--card)" stroke="var(--accent)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </>
      )}
      <circle cx={lastX} cy={lastY} r={1.8} fill="var(--accent)" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function capColor(pct: number | null): string {
  if (pct == null) return "var(--muted)";
  if (pct > 100) return "var(--st-critical)";
  if (pct >= 85) return "var(--st-high)";
  return "var(--st-low)";
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: "crit" | "warn" | "muted" }) {
  const fg = tone === "crit" ? "var(--st-critical-fg)" : tone === "warn" ? "var(--st-high-fg)" : "var(--muted)";
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 9, padding: "6px 11px" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 500, color: fg, letterSpacing: "-0.5px" }}>{value}</span>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

function Chip({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="cx-lift" style={{ textDecoration: "none", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{label}</Link>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 20 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</div>
      {hint && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{hint}</div>}
      {children}
    </div>
  );
}
