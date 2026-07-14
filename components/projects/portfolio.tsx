"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { computeRoi, type PortfolioRow, type SquadCapacity } from "@/lib/projects/queries";
import { portfolioRoi, squadLoads, wsjfParts, isOpenProject, type SquadLoad } from "@/lib/projects/portfolio";

const WSJF_SERIES = [
  { key: "bv" as const, field: "business_value" as const, color: "var(--accent-2)" },
  { key: "tc" as const, field: "time_criticality" as const, color: "var(--st-eval)" },
  { key: "rr" as const, field: "risk_reduction" as const, color: "var(--st-medium)" },
];

export function PortfolioCockpit({ rows, squads }: { rows: PortfolioRow[]; squads: SquadCapacity[] }) {
  const { t, locale } = useI18n();
  const money = (n: number) => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: "CRC", maximumFractionDigits: 0, notation: "compact" }).format(n);

  const roi = portfolioRoi(rows);
  const active = rows.filter((r) => r.status === "active").length;
  const loads = squadLoads(squads, rows);
  const withActuals = rows.filter((r) => r.actual_benefit_amount != null && r.actual_cost_amount != null);
  const roadmap = rows.filter((r) => r.planned_start && r.planned_end);
  const wl = { bv: t("proj.wsjf.bv"), tc: t("proj.wsjf.tc"), rr: t("proj.wsjf.rr"), js: t("proj.wsjf.js") };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Encabezado (hero credix.com: degradado calido en Claro, sobrio en Nexus) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", background: "var(--hero-grad)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-card)", padding: "22px 24px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "var(--text)", margin: 0 }}>{t("port.title")}</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0", maxWidth: 720 }}>{t("port.subtitle")}</p>
        </div>
        <Link href="/projects" className="cx-lift" style={{ textDecoration: "none", fontSize: 12.5, fontWeight: 700, color: "var(--text)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "9px 14px", background: "var(--card)" }}>{t("port.backKanban")}</Link>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Kpi label={t("port.kpi.projects")} value={rows.length} />
        <Kpi label={t("port.kpi.active")} value={active} />
        <Kpi label={t("port.kpi.benefit")} value={money(roi.estBenefit)} />
        <Kpi label={t("port.kpi.roiEst")} value={roi.estRoi != null ? `${roi.estRoi}%` : "—"} />
        <Kpi label={t("port.kpi.roiReal")} value={roi.realRoi != null ? `${roi.realRoi}%` : "—"}
          sub={`${roi.measured}/${roi.total} ${t("port.measured")}`}
          tone={roi.realRoi != null && roi.estRoi != null ? (roi.realRoi >= roi.estRoi ? "good" : "warn") : undefined} />
      </div>

      {/* WSJF desglosado + Capacidad */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 16 }}>
        <Panel title={t("port.wsjf.title")} hint={t("port.wsjf.hint")}>
          <Legend items={WSJF_SERIES.map((s) => ({ color: s.color, label: wl[s.key] }))} />
          {rows.length === 0 ? <Empty text="—" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
              {rows.slice(0, 12).map((r) => <WsjfRow key={r.id} r={r} maxNum={Math.max(1, ...rows.map((x) => wsjfParts(x).numerator))} labels={wl} />)}
            </div>
          )}
        </Panel>

        <Panel title={t("port.capacity.title")} hint={t("port.capacity.hint")}>
          {loads.length === 0 ? <Empty text={t("port.capacity.empty")} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              {loads.map((l) => <CapacityRow key={l.id} l={l} labelProjects={t("port.projects")} labelOver={t("port.capacity.over")} />)}
            </div>
          )}
        </Panel>
      </div>

      {/* ROI estimado vs real */}
      <Panel title={t("port.roi.title")} hint={t("port.roi.hint")}>
        {withActuals.length === 0 ? <Empty text={t("port.roi.empty")} /> : (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "right", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
                  <Th align="left">{t("proj.field.name")}</Th>
                  <Th>{t("port.est")}</Th><Th>{t("port.real")}</Th><Th>{t("port.delta")}</Th>
                </tr>
              </thead>
              <tbody>
                {withActuals.map((r) => {
                  const est = computeRoi(Number(r.estimated_benefit_amount), Number(r.estimated_cost_amount));
                  const real = computeRoi(Number(r.actual_benefit_amount), Number(r.actual_cost_amount));
                  const delta = est != null && real != null ? real - est : null;
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--line-soft, var(--line))" }}>
                      <Td align="left" strong><Link href={`/projects/${r.id}`} style={{ color: "var(--text)", textDecoration: "none" }}>{r.name}</Link></Td>
                      <Td>{est != null ? `${est}%` : "—"}</Td>
                      <Td>{real != null ? `${real}%` : "—"}</Td>
                      <Td tone={delta == null ? undefined : delta >= 0 ? "good" : "warn"}>{delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta}%`}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Roadmap */}
      <Panel title={t("port.roadmap.title")} hint={t("port.roadmap.hint")}>
        {roadmap.length === 0 ? <Empty text={t("port.roadmap.empty")} /> : <Roadmap rows={roadmap} locale={locale} />}
      </Panel>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone?: "good" | "warn" }) {
  const color = tone === "good" ? "var(--st-low-fg)" : tone === "warn" ? "var(--st-high-fg)" : "var(--text)";
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
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
function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color }} />{it.label}
        </span>
      ))}
    </div>
  );
}
function Th({ children, align = "right" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th style={{ textAlign: align, padding: "8px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, align = "right", strong, tone }: { children: React.ReactNode; align?: "left" | "right"; strong?: boolean; tone?: "good" | "warn" }) {
  const color = tone === "good" ? "var(--st-low-fg)" : tone === "warn" ? "var(--st-high-fg)" : "var(--text)";
  return <td style={{ textAlign: align, padding: "8px 10px", fontFamily: align === "right" ? "var(--font-mono)" : undefined, fontWeight: strong ? 700 : 400, color, whiteSpace: "nowrap" }}>{children}</td>;
}

/** Fila WSJF: barra segmentada del numerador (3 componentes) + tamano + WSJF. */
function WsjfRow({ r, maxNum, labels }: { r: PortfolioRow; maxNum: number; labels: { bv: string; tc: string; rr: string; js: string } }) {
  const parts = wsjfParts(r);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Link href={`/projects/${r.id}`} title={r.name} style={{ width: 150, flexShrink: 0, fontSize: 12.5, color: "var(--text)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</Link>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 12, display: "flex", background: "var(--track, var(--paper))", borderRadius: 6, overflow: "hidden" }}>
          {WSJF_SERIES.map((s) => {
            const v = Number(r[s.field] ?? 0);
            const w = (v / maxNum) * 100;
            return w > 0 ? <div key={s.key} title={`${labels[s.key]}: ${v}`} style={{ width: `${w}%`, height: "100%", background: s.color, marginRight: 1 }} /> : null;
          })}
        </div>
        <span title={labels.js} style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)", flexShrink: 0 }}>/{parts.jobSize}</span>
        <span title="WSJF" style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent-2)", width: 34, textAlign: "right", flexShrink: 0 }}>{Number(r.wsjf).toFixed(1)}</span>
      </div>
    </div>
  );
}

/** Carga por squad: barra demanda/capacidad; sobrecarga en rojo. */
function CapacityRow({ l, labelProjects, labelOver }: { l: SquadLoad; labelProjects: string; labelOver: string }) {
  const pct = l.loadPct ?? 0;
  const barColor = l.over ? "var(--st-critical)" : pct >= 80 ? "var(--st-high)" : "var(--accent)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{l.name}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: l.over ? "var(--st-critical-fg)" : "var(--muted)" }}>
          {l.committed}/{l.capacity} {l.loadPct != null ? `· ${l.loadPct}%` : ""}
        </span>
      </div>
      <div style={{ height: 8, background: "var(--track, var(--paper))", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: barColor, borderRadius: 4 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 10.5, color: "var(--muted)" }}>
        <span>{l.projects} {labelProjects}</span>
        {l.over && <span style={{ color: "var(--st-critical-fg)", fontWeight: 700 }}>{labelOver}</span>}
      </div>
    </div>
  );
}

/** Roadmap (Gantt-lite): ventana planificada por proyecto sobre eje de meses; ejecucion real como linea. */
function Roadmap({ rows, locale }: { rows: PortfolioRow[]; locale: string }) {
  const times = rows.flatMap((r) => [r.planned_start, r.planned_end].filter(Boolean) as string[]).map((d) => new Date(d + "T00:00:00").getTime());
  const min = Math.min(...times), max = Math.max(...times);
  const span = Math.max(1, max - min);
  const pos = (d: string) => ((new Date(d + "T00:00:00").getTime() - min) / span) * 100;
  const months: { label: string; left: number }[] = [];
  const cur = new Date(min); cur.setDate(1);
  const end = new Date(max);
  while (cur.getTime() <= end.getTime() && months.length < 24) {
    months.push({ label: cur.toLocaleDateString(locale === "es" ? "es-CR" : "en-US", { month: "short" }), left: ((cur.getTime() - min) / span) * 100 });
    cur.setMonth(cur.getMonth() + 1);
  }
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ position: "relative", height: 16, marginLeft: 158, marginBottom: 6 }}>
        {months.map((m, i) => <span key={i} style={{ position: "absolute", left: `${m.left}%`, fontSize: 9.5, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>{m.label}</span>)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {rows.slice(0, 14).map((r) => {
          const left = pos(r.planned_start!), width = Math.max(1.5, pos(r.planned_end!) - left);
          const open = isOpenProject(r.status);
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link href={`/projects/${r.id}`} title={r.name} style={{ width: 150, flexShrink: 0, fontSize: 12, color: "var(--text)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</Link>
              <div style={{ position: "relative", flex: 1, height: 18, background: "var(--track, var(--paper))", borderRadius: 5 }}>
                <div title={`${r.planned_start} → ${r.planned_end}`} style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: 3, height: 12, background: open ? "var(--accent)" : "var(--st-low)", borderRadius: 4, opacity: r.status === "cancelled" ? 0.4 : 1 }} />
                {r.actual_start && (
                  <div style={{ position: "absolute", left: `${pos(r.actual_start)}%`, width: `${Math.max(1, pos(r.actual_end ?? r.planned_end!) - pos(r.actual_start))}%`, bottom: 1, height: 2.5, background: "var(--text)", borderRadius: 2 }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
