"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { BackButton } from "@/components/common/back-button";
import { BEHAVIOR_DIMENSIONS, type BehaviorAnalysis, type BehaviorDimension, type BehaviorGroup } from "@/lib/analytics/queries";

// Refinamiento SOLO VISUAL. Mismos datos/RPC/calculos: cambia la presentacion.
// Layout responsive, hover, zebra y sticky viven en una hoja de estilo acotada por `.beh`.

const DIM_LABEL: Record<BehaviorDimension, MessageKey> = {
  category: "beh.dim.category", product: "beh.dim.product", service: "beh.dim.service",
  business_unit: "beh.dim.business_unit", channel: "beh.dim.channel", process: "beh.dim.process", priority: "beh.dim.priority",
};
const WINDOWS = [4, 8, 12, 26, 52];

type NumKey = "total" | "open" | "mttr_hours" | "sla_breached" | "transformation_candidates" | "with_problem" | "momentum" | "financial_impact";
const DETAIL_COLS: { key: NumKey; label: MessageKey; def: MessageKey; kind: "num" | "mttr" | "sla" | "mom" | "money" }[] = [
  { key: "total", label: "beh.col.total", def: "beh.def.total", kind: "num" },
  { key: "open", label: "beh.col.open", def: "beh.def.open", kind: "num" },
  { key: "mttr_hours", label: "beh.col.mttr", def: "beh.def.mttr", kind: "mttr" },
  { key: "sla_breached", label: "beh.col.sla", def: "beh.def.sla", kind: "sla" },
  { key: "transformation_candidates", label: "beh.col.cand", def: "beh.def.cand", kind: "num" },
  { key: "with_problem", label: "beh.col.problem", def: "beh.def.problem", kind: "num" },
  { key: "momentum", label: "beh.col.momentum", def: "beh.def.momentum", kind: "mom" },
  { key: "financial_impact", label: "beh.col.financial", def: "beh.def.financial", kind: "money" },
];
type SortKey = "label" | NumKey;

const CSS = `
.beh { display:flex; flex-direction:column; gap:16px;
  --rank-cols: minmax(132px,1.5fr) minmax(48px,1.5fr) 46px 56px 58px 50px 66px; }
.beh .beh-card { background:var(--card); border:1px solid var(--line); border-radius:var(--r-xl); box-shadow:var(--sh-card); }
.beh .beh-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 18px; }
.beh .beh-h1 { font-family:var(--font-display); font-weight:800; font-size:16px; color:var(--text); margin:0; white-space:nowrap; }
.beh .beh-sub { font-size:12.5px; color:var(--muted); flex:1; min-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.beh .beh-controls { display:flex; flex-wrap:wrap; gap:10px 22px; align-items:center; }
.beh .beh-cg { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.beh .beh-cg-lbl { font-size:10px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; color:var(--muted); }
.beh .beh-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }
.beh .beh-row2 { display:grid; grid-template-columns:1fr; gap:16px; align-items:stretch; }
@media (min-width:1024px){ .beh .beh-row2 { grid-template-columns:minmax(0,1.6fr) minmax(0,1fr); } }
.beh .beh-rank-head, .beh .beh-rank-row { display:grid; grid-template-columns:var(--rank-cols); align-items:center; column-gap:10px; }
.beh .beh-rank-head { padding:0 8px 9px; border-bottom:1px solid var(--line); }
.beh .beh-rank-head > span { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.3px; color:var(--muted); }
.beh .beh-rank-row { padding:8px; border-radius:8px; }
.beh .beh-rank-rows > .beh-rank-row:nth-child(even){ background:var(--paper); }
.beh .beh-rank-row:hover { background:var(--accent-soft); }
.beh .beh-num { font-family:var(--font-mono); font-variant-numeric:tabular-nums; text-align:right; font-size:12px; color:var(--text); }
.beh .beh-hnum { text-align:right; }
.beh .beh-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12.5px; color:var(--text); }
.beh .beh-track { height:10px; background:var(--track,var(--paper)); border-radius:5px; overflow:hidden; }
.beh .beh-fill { height:100%; background:var(--accent); border-radius:5px; }
.beh .beh-trend-body { flex:1; min-height:260px; position:relative; }
.beh .beh-micro { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.beh .beh-detail-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:10px; }
.beh .beh-tablewrap { display:none; }
@media (min-width:1280px){ .beh .beh-tablewrap { display:block; max-height:72vh; overflow:auto; border-radius:12px; } .beh .beh-detail-cards { display:none; } }
.beh .beh-table { width:100%; border-collapse:separate; border-spacing:0; font-size:12.5px; }
.beh .beh-table th { position:sticky; top:0; background:var(--card); z-index:2; font-weight:700; color:var(--muted); text-align:right; padding:9px 10px; white-space:nowrap; cursor:pointer; user-select:none; border-bottom:1px solid var(--line); }
.beh .beh-table th.beh-first, .beh .beh-table td.beh-first { position:sticky; left:0; text-align:left; max-width:240px; overflow:hidden; text-overflow:ellipsis; }
.beh .beh-table th.beh-first { z-index:3; }
.beh .beh-table td.beh-first { z-index:1; font-family:var(--font-ui); font-weight:600; }
.beh .beh-table td { padding:8px 10px; text-align:right; font-family:var(--font-mono); font-variant-numeric:tabular-nums; white-space:nowrap; color:var(--text); border-bottom:1px solid var(--line-soft,var(--line)); background:var(--card); }
.beh .beh-table tbody tr:nth-child(even) td { background:var(--paper); }
.beh .beh-table tbody tr:hover td { background:var(--accent-soft); }
`;

export function BehaviorAnalysisView({ data, dimension, weeks }: { data: BehaviorAnalysis; dimension: BehaviorDimension; weeks: number }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  const go = (dim: BehaviorDimension, w: number) =>
    startTransition(() => router.push(`/analytics/comportamiento?dim=${dim}&weeks=${w}`));

  const fmtMoney = (n: number) => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(n);
  const fmtMoneyShort = (n: number) =>
    Math.abs(n) >= 1_000_000
      ? "₡" + (n / 1_000_000).toLocaleString(locale === "es" ? "es-CR" : "en-US", { maximumFractionDigits: 1 }) + " M"
      : fmtMoney(n);
  const dimLabel = t(DIM_LABEL[dimension]);
  const proj = data.projection;
  const max = Math.max(1, ...data.groups.map((x) => x.total));

  // Orden por defecto = orden del RPC. El sort del usuario es adicional y solo visual.
  const sortedGroups = useMemo(() => {
    if (!sort) return data.groups;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...data.groups].sort((a, b) =>
      sort.key === "label" ? a.label.localeCompare(b.label) * dir : ((a[sort.key] as number) - (b[sort.key] as number)) * dir);
  }, [data.groups, sort]);
  const clickSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "label" ? "asc" : "desc" }));

  return (
    <div className="beh" style={{ opacity: pending ? 0.6 : 1, transition: "opacity .15s" }}>
      <style>{CSS}</style>
      <BackButton fallback="/analytics" />

      {/* 1. Encabezado compacto: una linea, descripcion completa en (i) */}
      <div className="beh-card beh-head">
        <h1 className="beh-h1">{t("beh.title")}</h1>
        <InfoTip text={t("beh.subtitle")} />
        <span className="beh-sub">{t("beh.subtitle")}</span>
      </div>

      {/* Controles en una fila con wrap; estado activo bien contrastado; persistencia en URL intacta */}
      <div className="beh-controls">
        <div className="beh-cg">
          <span className="beh-cg-lbl">{t("beh.groupBy")}</span>
          {BEHAVIOR_DIMENSIONS.map((d) => <Pill key={d} active={d === dimension} onClick={() => go(d, weeks)}>{t(DIM_LABEL[d])}</Pill>)}
        </div>
        <div className="beh-cg">
          <span className="beh-cg-lbl">{t("beh.window")}</span>
          {WINDOWS.map((w) => <Pill key={w} active={w === weeks} onClick={() => go(dimension, w)}>{w}{t("beh.weeksUnit")}</Pill>)}
        </div>
      </div>

      {/* KPIs */}
      <div className="beh-kpis">
        <Kpi label={t("beh.kpi.total")} value={data.total_incidents} />
        <Kpi label={t("beh.kpi.open")} value={data.open_incidents} />
        <Kpi label={t("beh.kpi.groups")} value={data.groups_total} />
        <Kpi label={t("beh.kpi.projection")} value={proj ? proj.next_week : "—"} hint={proj ? (proj.slope > 0 ? "up" : proj.slope < 0 ? "down" : "flat") : undefined} />
        <Kpi label={t("beh.kpi.signals")} value={data.signals.length} danger={data.signals.length > 0} />
      </div>

      {/* 2 + 3. Ranking (tabla alineada) + Tendencia (llena su panel) */}
      <div className="beh-row2">
        <div className="beh-card" style={{ padding: 20, display: "flex", flexDirection: "column" }}>
          <PanelHead title={`${t("beh.ranking")} · ${dimLabel}`} />
          {data.groups.length === 0 ? <Empty text={t("beh.empty")} /> : (
            <div style={{ marginTop: 12 }}>
              <div className="beh-rank-head">
                <span title={t("beh.def.label")}>{dimLabel}</span>
                <span title={t("beh.def.total")}>{t("beh.vol")}</span>
                <span className="beh-hnum" title={t("beh.def.total")}>{t("beh.col.total")}</span>
                <span className="beh-hnum" title={t("beh.def.open")}>{t("beh.col.open")}</span>
                <span className="beh-hnum" title={t("beh.def.sla")}>{t("beh.col.sla")}</span>
                <span className="beh-hnum" title={t("beh.def.cand")}>{t("beh.col.cand")}</span>
                <span className="beh-hnum" title={t("beh.def.momentum")}>{t("beh.col.momentum")}</span>
              </div>
              <div className="beh-rank-rows">
                {data.groups.map((g) => <RankRow key={g.key} g={g} max={max} t={t} />)}
              </div>
            </div>
          )}
          {data.groups_total > data.groups.length && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>{t("beh.showing")} {data.groups.length} / {data.groups_total}</div>
          )}
        </div>

        <TrendPanel data={data} proj={proj} t={t} />
      </div>

      {/* 5. Senales de causa-raiz (contenido intacto, espaciado homologado) */}
      <div className="beh-card" style={{ padding: 20 }}>
        <PanelHead title={t("beh.signals.title")} hint={t("beh.signals.hint")} />
        {data.signals.length === 0 ? <Empty text={t("beh.signals.empty")} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {data.signals.map((s) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "var(--st-high-bg, var(--paper))", border: "1px solid var(--st-high-border, var(--line))", borderRadius: 12 }}>
                <Icon name="alert" size={18} color="var(--st-high-fg)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {s.total} {t("beh.cases")} · <Momentum v={s.momentum} t={t} inline /> · {t("beh.score")} {s.avg_transformation_score} · {t("beh.noproblem")}
                  </div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "var(--st-high-fg)", border: "1px solid var(--st-high-border, var(--line))", borderRadius: 8, padding: "5px 10px", background: "var(--card)" }}>{t("beh.considerRC")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Detalle por grupo: tabla sin cortes (>=1280) / tarjetas (<1280) */}
      {data.groups.length > 0 && (
        <div className="beh-card" style={{ padding: 20 }}>
          <PanelHead title={t("beh.table.title")} hint={t("beh.sortHint")} />
          <div className="beh-tablewrap" style={{ marginTop: 12 }}>
            <table className="beh-table">
              <thead>
                <tr>
                  <th className="beh-first" title={t("beh.def.label")} onClick={() => clickSort("label")}>{dimLabel}<SortCaret active={sort?.key === "label"} dir={sort?.dir} /></th>
                  {DETAIL_COLS.map((c) => (
                    <th key={c.key} title={t(c.def)} onClick={() => clickSort(c.key)}>{t(c.label)}<SortCaret active={sort?.key === c.key} dir={sort?.dir} /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedGroups.map((g) => (
                  <tr key={g.key}>
                    <td className="beh-first" title={g.label}>{g.label}</td>
                    {DETAIL_COLS.map((c) => <td key={c.key}>{cell(g, c, t, fmtMoney, fmtMoneyShort)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="beh-detail-cards" style={{ marginTop: 12 }}>
            {sortedGroups.map((g) => (
              <div key={g.key} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 10 }}>{g.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "auto auto", rowGap: 7, columnGap: 14, fontSize: 12 }}>
                  {DETAIL_COLS.map((c) => (
                    <div key={c.key} style={{ display: "contents" }}>
                      <span style={{ color: "var(--muted)" }} title={t(c.def)}>{t(c.label)}</span>
                      <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>{cell(g, c, t, fmtMoney, fmtMoneyShort)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function cell(g: BehaviorGroup, c: (typeof DETAIL_COLS)[number], t: (k: MessageKey) => string, fmtMoney: (n: number) => string, fmtShort: (n: number) => string) {
  if (c.kind === "mttr") return `${g.mttr_hours}h`;
  if (c.kind === "sla") return <span style={{ color: g.sla_breached > 0 ? "var(--st-critical-fg)" : undefined }}>{g.sla_breached}</span>;
  if (c.kind === "mom") return <span style={{ display: "inline-flex", justifyContent: "flex-end", width: "100%" }}><Momentum v={g.momentum} t={t} /></span>;
  if (c.kind === "money") return <span title={fmtMoney(g.financial_impact)}>{fmtShort(g.financial_impact)}</span>;
  return String(g[c.key as NumKey]);
}

function InfoTip({ text }: { text: string }) {
  return (
    <span title={text} tabIndex={0} aria-label={text}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: "50%", border: "1px solid var(--muted)", color: "var(--muted)", fontSize: 10, fontWeight: 800, cursor: "help", flexShrink: 0, fontFamily: "var(--font-ui)", lineHeight: 1 }}>i</span>
  );
}

function SortCaret({ active, dir }: { active?: boolean; dir?: "asc" | "desc" }) {
  if (!active) return null;
  return <Icon name={dir === "asc" ? "chevron-up" : "chevron-down"} size={12} color="var(--accent-2)" style={{ verticalAlign: "-1px", marginLeft: 3 }} />;
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      cursor: "pointer", fontSize: 12.5, fontWeight: active ? 700 : 500, padding: "6px 12px", borderRadius: 9,
      border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
      background: active ? "var(--accent)" : "var(--card)", color: active ? "var(--on-accent, #fff)" : "var(--text)",
    }}>{children}</button>
  );
}

function Kpi({ label, value, hint, danger }: { label: string; value: number | string; hint?: "up" | "down" | "flat"; danger?: boolean }) {
  const hintColor = hint === "up" ? "var(--st-high-fg)" : hint === "down" ? "var(--st-low-fg)" : "var(--muted)";
  return (
    <div className="beh-card" style={{ padding: 16 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 500, fontSize: 24, letterSpacing: "-1px", color: danger ? "var(--st-critical-fg)" : "var(--text)" }}>{value}</span>
        {hint && hint !== "flat" && <Icon name={hint === "up" ? "chevron-up" : "chevron-down"} size={18} color={hintColor} />}
      </div>
    </div>
  );
}

function PanelHead({ title, hint, right }: { title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</div>
        {hint && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{hint}</div>}
      </div>
      {right}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "18px 0" }}>{text}</div>;
}

function Momentum({ v, t, inline }: { v: number; t: (k: MessageKey) => string; inline?: boolean }) {
  const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
  const color = dir === "up" ? "var(--st-high-fg)" : dir === "down" ? "var(--st-low-fg)" : "var(--muted)";
  const label = dir === "up" ? t("beh.momentum.up") : dir === "down" ? t("beh.momentum.down") : t("beh.momentum.flat");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color, fontWeight: 600, fontFamily: inline ? undefined : "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
      {dir !== "flat" && <Icon name={dir === "up" ? "chevron-up" : "chevron-down"} size={13} color={color} />}
      {inline ? label : (v > 0 ? `+${v}` : String(v))}
    </span>
  );
}

function RankRow({ g, max, t }: { g: BehaviorGroup; max: number; t: (k: MessageKey) => string }) {
  return (
    <div className="beh-rank-row">
      <span className="beh-label" title={g.label}>{g.label}</span>
      <div className="beh-track"><div className="beh-fill" style={{ width: `${(g.total / max) * 100}%` }} /></div>
      <span className="beh-num">{g.total}</span>
      <span className="beh-num">{g.open}</span>
      <span className="beh-num" style={{ color: g.sla_breached > 0 ? "var(--st-critical-fg)" : undefined }}>{g.sla_breached}</span>
      <span className="beh-num" style={{ color: g.transformation_candidates > 0 ? "var(--accent)" : undefined }}>{g.transformation_candidates}</span>
      <span className="beh-num" style={{ display: "flex", justifyContent: "flex-end" }}><Momentum v={g.momentum} t={t} /></span>
    </div>
  );
}

/** Tamano real del contenedor (ResizeObserver) para que el grafico llene su panel sin distorsion. */
function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: Math.round(cr.width), h: Math.round(cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

function TrendPanel({ data, proj, t }: { data: BehaviorAnalysis; proj: BehaviorAnalysis["projection"]; t: (k: MessageKey) => string }) {
  const { ref, size } = useSize();
  const points = data.trend;
  const sum = points.reduce((s, p) => s + p.count, 0);
  const avg = points.length ? Math.round((sum / points.length) * 10) / 10 : 0;
  const projDir = proj ? (proj.slope > 0 ? "up" : proj.slope < 0 ? "down" : "flat") : "flat";

  return (
    <div className="beh-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, minHeight: 320 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("beh.trend")}</div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--muted)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, height: 2, background: "var(--accent)", borderRadius: 2 }} />{t("beh.legend.real")}</span>
          {proj && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, height: 0, borderTop: "2px dashed var(--accent)" }} />{t("beh.legend.proj")}</span>}
        </div>
      </div>

      <div className="beh-trend-body" ref={ref}>
        {size.w > 0 && size.h > 0
          ? <TrendSvg points={points} projection={proj} w={size.w} h={size.h} />
          : (points.length === 0 ? <Empty text="—" /> : null)}
      </div>

      <div className="beh-micro">
        <Micro label={t("beh.trend.totalwin")} value={String(data.total_incidents)} />
        <Micro label={t("beh.trend.avgweek")} value={String(avg)} />
        <Micro label={t("beh.kpi.projection")} value={proj ? String(proj.next_week) : "—"} dir={proj ? projDir : undefined} />
      </div>
    </div>
  );
}

function Micro({ label, value, dir }: { label: string; value: string; dir?: "up" | "down" | "flat" }) {
  const color = dir === "up" ? "var(--st-high-fg)" : dir === "down" ? "var(--st-low-fg)" : "var(--text)";
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px" }}>
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 17, fontWeight: 500, color }}>{value}</span>
        {dir && dir !== "flat" && <Icon name={dir === "up" ? "chevron-up" : "chevron-down"} size={15} color={color} />}
      </div>
    </div>
  );
}

/** Tendencia semanal en pixeles exactos (texto nitido): ejes, gridlines, proyeccion punteada y
 *  tooltip por punto. Dato real del RPC (no se recalcula nada). */
function TrendSvg({ points, projection, w, h }: { points: { week: string; count: number }[]; projection: BehaviorAnalysis["projection"]; w: number; h: number }) {
  if (points.length === 0) return null;
  const padL = 34, padR = 12, padT = 10, padB = 22;
  const iw = Math.max(1, w - padL - padR);
  const ih = Math.max(1, h - padT - padB);
  const projValue = projection ? projection.next_week : null;
  const nSlots = points.length + (projValue != null ? 1 : 0);
  const max = Math.max(1, ...points.map((p) => p.count), projValue ?? 0);
  const X = (i: number) => (nSlots <= 1 ? padL + iw / 2 : padL + (i / (nSlots - 1)) * iw);
  const Y = (v: number) => padT + ih - (v / max) * ih;
  const line = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.count).toFixed(1)}`).join(" ");
  const area = `${line} L${X(points.length - 1).toFixed(1)} ${padT + ih} L${X(0).toFixed(1)} ${padT + ih} Z`;
  const last = points[points.length - 1];
  const yTicks = [0, 1, 2, 3].map((k) => { const v = (max * (3 - k)) / 3; return { v: Math.round(v), y: Y(v) }; });
  const tickEvery = Math.max(1, Math.ceil(points.length / 6));
  const mmdd = (s: string) => (s.length >= 10 ? s.slice(5) : s);
  const gid = "beharea";

  return (
    <svg width={w} height={h} role="img" aria-label="Tendencia semanal" style={{ display: "block" }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".22" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
      {yTicks.map((tk, i) => (
        <g key={i}>
          <line x1={padL} y1={tk.y} x2={w - padR} y2={tk.y} stroke="var(--line-soft, var(--line))" strokeWidth="1" />
          <text x={padL - 6} y={tk.y + 3} textAnchor="end" fontSize="9" fill="var(--muted)" fontFamily="var(--font-mono)">{tk.v}</text>
        </g>
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {projValue != null && (
        <>
          <line x1={X(points.length - 1)} y1={Y(last.count)} x2={X(points.length)} y2={Y(projValue)} stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="4 3" />
          <circle cx={X(points.length)} cy={Y(projValue)} r="3.5" fill="var(--card)" stroke="var(--accent)" strokeWidth="1.6"><title>{`→ ${projValue}`}</title></circle>
        </>
      )}
      {points.map((p, i) => (
        <circle key={i} cx={X(i)} cy={Y(p.count)} r={i === points.length - 1 ? 3.5 : 2.5} fill="var(--accent)">
          <title>{`${mmdd(p.week)} · ${p.count}`}</title>
        </circle>
      ))}
      {points.map((p, i) => (i % tickEvery === 0 || i === points.length - 1) && (
        <text key={`x${i}`} x={X(i)} y={h - 6} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--font-mono)">{mmdd(p.week)}</text>
      ))}
    </svg>
  );
}
