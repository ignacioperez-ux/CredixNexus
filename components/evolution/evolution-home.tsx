"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { EvolutionHome as HomeData } from "@/lib/evolution/queries";
import type { TribeLoad } from "@/lib/projects/portfolio";
import { ConceptTip } from "@/components/help/concept-tip";

type Roi = { estRoi: number | null; realRoi: number | null; total: number };

export function EvolutionHome({ home, roi, tribes }: { home: HomeData; roi: Roi; tribes: TribeLoad[] }) {
  const { t } = useI18n();
  const f = home.funnel;
  const h = home.health;
  const steps: { key: MessageKey; value: number; tip?: string }[] = [
    { key: "evh.funnel.candidates", value: f.candidates ?? 0, tip: "case" },
    { key: "evh.funnel.recPending", value: f.rec_pending ?? 0 },
    { key: "evh.funnel.recApproved", value: f.rec_approved ?? 0 },
    { key: "evh.funnel.inEvolution", value: f.in_evolution ?? 0 },
    { key: "evh.funnel.active", value: f.proj_active ?? 0, tip: "initiative" },
    { key: "evh.funnel.done", value: f.proj_done ?? 0 },
  ];
  const topTribes = tribes.filter((tr) => tr.squads > 0).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Hero */}
      <div style={{ background: "var(--hero-grad)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-card)", padding: "24px 26px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--text)", margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
          {t("evh.title")} <ConceptTip concept="initiative" />
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "6px 0 0", maxWidth: 760 }}>{t("evh.subtitle")}</p>
      </div>

      {/* Funnel incidencia -> evolucion */}
      <Panel title={t("evh.funnel.title")} hint={t("evh.funnel.hint")}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 0, marginTop: 12 }}>
          {steps.map((s, i) => (
            <div key={s.key} style={{ flex: "1 1 130px", minWidth: 130, background: "var(--card)", border: "1px solid var(--line)", borderLeft: i === 0 ? "1px solid var(--line)" : "none", padding: "13px 14px", borderRadius: i === 0 ? "var(--r-lg) 0 0 var(--r-lg)" : i === steps.length - 1 ? "0 var(--r-lg) var(--r-lg) 0" : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px" }}>{t(s.key)}</span>
                {s.tip && <ConceptTip concept={s.tip} size={13} />}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 500, letterSpacing: "-1px", color: "var(--text)", marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* KPIs de gobierno */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Kpi label={t("evh.kpi.roi")} value={roi.estRoi != null ? `${roi.estRoi}%` : "—"} href="/projects/portafolio" />
        <Kpi label={t("evh.kpi.active")} value={f.proj_active ?? 0} href="/projects" />
        <Kpi label={t("evh.kpi.blocked")} value={h.blocked ?? 0} tone={((h.blocked ?? 0) > 0) ? "crit" : undefined} href="/projects" />
        <Kpi label={t("evh.kpi.atrisk")} value={h.at_risk ?? 0} tone={((h.at_risk ?? 0) > 0) ? "warn" : undefined} href="/projects" />
        <Kpi label={t("evh.kpi.signals")} value={home.signals ?? 0} tone={((home.signals ?? 0) > 0) ? "warn" : undefined} href="/analytics/comportamiento" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        {/* Capacidad por tribu */}
        <Panel title={t("evh.tribes.title")} hint={t("evh.tribes.hint")}>
          {topTribes.length === 0 ? <Empty text={t("evh.tribes.empty")} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 12 }}>
              {topTribes.map((tr) => {
                const pct = tr.loadPct ?? 0;
                const col = tr.over ? "var(--st-critical)" : pct >= 80 ? "var(--st-high)" : "var(--accent)";
                return (
                  <div key={tr.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>{tr.name}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: tr.over ? "var(--st-critical-fg)" : "var(--muted)" }}>{tr.committed}/{tr.capacity}{tr.loadPct != null ? ` · ${tr.loadPct}%` : ""}</span>
                    </div>
                    <div style={{ height: 8, background: "var(--track, var(--paper))", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: col, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
              <Link href="/projects/portafolio" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-2)", textDecoration: "none", marginTop: 2 }}>{t("evh.tribes.more")} →</Link>
            </div>
          )}
        </Panel>

        {/* Accesos rapidos */}
        <Panel title={t("evh.links.title")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <QuickLink href="/projects/portafolio" title={t("nav.portfolio")} desc={t("evh.links.portfolio")} />
            <QuickLink href="/evolucion/mapa" title={t("nav.tribemap")} desc={t("evh.links.tribes")} />
            <QuickLink href="/analytics/comportamiento" title={t("beh.title")} desc={t("evh.links.behavior")} />
            <QuickLink href="/casos-convertidos" title={t("cc.title")} desc={t("evh.links.converted")} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: "crit" | "warn" }) {
  const color = tone === "crit" ? "var(--st-critical-fg)" : tone === "warn" ? "var(--st-high-fg)" : "var(--text)";
  const inner = (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16, height: "100%" }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 24, letterSpacing: "-1px", color }}>{value}</div>
    </div>
  );
  return href ? <Link href={href} className="cx-lift" style={{ textDecoration: "none", display: "block", borderRadius: "var(--r-xl)" }}>{inner}</Link> : inner;
}
function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="cx-lift" style={{ textDecoration: "none", display: "block", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 14 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>{title}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>{desc}</div>
    </Link>
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
function Empty({ text }: { text: string }) { return <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "16px 0" }}>{text}</div>; }
