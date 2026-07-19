"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { BackButton } from "@/components/common/back-button";
import { BEHAVIOR_DIMENSIONS, type BehaviorAnalysis, type BehaviorDimension, type BehaviorGroup } from "@/lib/analytics/queries";

// 2a iteracion, SOLO presentacion/interaccion. RPC y calculos intactos; ?dim=&weeks= conservado.

const DIM_LABEL: Record<BehaviorDimension, MessageKey> = {
  category: "beh.dim.category", product: "beh.dim.product", service: "beh.dim.service",
  business_unit: "beh.dim.business_unit", channel: "beh.dim.channel", process: "beh.dim.process", priority: "beh.dim.priority",
};
const WINDOWS = [4, 8, 12, 26, 52];

type NumKey = "total" | "open" | "mttr_hours" | "sla_breached" | "transformation_candidates" | "with_problem" | "momentum" | "financial_impact";
type SortKey = "label" | NumKey;
type Col = { key: NumKey; label: MessageKey; def: MessageKey; kind: "num" | "mttr" | "sla" | "cand" | "mom" | "money"; zero?: boolean };
const RANK_COLS: Col[] = [
  { key: "open", label: "beh.col.open", def: "beh.def.open", kind: "num" },
  { key: "sla_breached", label: "beh.col.sla", def: "beh.def.sla", kind: "sla", zero: true },
  { key: "transformation_candidates", label: "beh.col.cand", def: "beh.def.cand", kind: "cand", zero: true },
  { key: "momentum", label: "beh.col.momentum", def: "beh.def.momentum", kind: "mom" },
  { key: "financial_impact", label: "beh.col.financial", def: "beh.def.financial", kind: "money", zero: true },
];
const DETAIL_COLS: Col[] = [
  { key: "total", label: "beh.col.total", def: "beh.def.total", kind: "num" },
  { key: "open", label: "beh.col.open", def: "beh.def.open", kind: "num" },
  { key: "mttr_hours", label: "beh.col.mttr", def: "beh.def.mttr", kind: "mttr", zero: true },
  { key: "sla_breached", label: "beh.col.sla", def: "beh.def.sla", kind: "sla", zero: true },
  { key: "transformation_candidates", label: "beh.col.cand", def: "beh.def.cand", kind: "cand", zero: true },
  { key: "with_problem", label: "beh.col.problem", def: "beh.def.problem", kind: "num", zero: true },
  { key: "momentum", label: "beh.col.momentum", def: "beh.def.momentum", kind: "mom" },
  { key: "financial_impact", label: "beh.col.financial", def: "beh.def.financial", kind: "money", zero: true },
];

const CSS = `
.ba { display:flex; flex-direction:column; gap:12px; }
.ba .ba-card { background:var(--card); border:1px solid var(--line); border-radius:var(--r-xl); box-shadow:var(--sh-card); }
.ba .ba-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:11px 16px; }
.ba .ba-controls { display:flex; flex-wrap:wrap; gap:8px 20px; align-items:center; }
.ba .ba-cg { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
.ba .ba-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; }
.ba .ba-trendbody { position:relative; height:200px; }
.ba .ba-micro { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.ba .ba-wrap { overflow-x:auto; }
.ba .ba-t { width:100%; border-collapse:separate; border-spacing:0; font-size:12px; }
.ba .ba-t th { position:sticky; top:0; background:var(--card); z-index:2; text-align:right; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.3px; color:var(--muted); padding:8px 10px; white-space:nowrap; border-bottom:1px solid var(--line); cursor:pointer; user-select:none; }
.ba .ba-t th.ba-first, .ba .ba-t td.ba-first { position:sticky; left:0; text-align:left; background:var(--card); min-width:150px; max-width:220px; overflow:hidden; text-overflow:ellipsis; }
.ba .ba-t th.ba-first { z-index:3; }
.ba .ba-t td { padding:7px 10px; text-align:right; font-family:var(--font-mono); font-variant-numeric:tabular-nums; white-space:nowrap; color:var(--text); border-bottom:1px solid var(--line-soft,var(--line)); background:var(--card); }
.ba .ba-t td.ba-first { font-family:var(--font-ui); font-weight:600; overflow:hidden; text-overflow:ellipsis; }
.ba .ba-t tbody tr:nth-child(even) td { background:var(--paper); }
.ba .ba-t tbody tr:hover td { background:var(--accent-soft); }
.ba .ba-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:10px; }
`;

export function BehaviorAnalysisView({ data, dimension, weeks }: { data: BehaviorAnalysis; dimension: BehaviorDimension; weeks: number }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rankSort, setRankSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "total", dir: "desc" });
  const [detSort, setDetSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  // scroll:false conserva la posicion del lector: cambiar Ventana o Agrupar por no debe
  // saltar al tope (los controles de agrupacion viven bajo la tendencia).
  const go = (dim: BehaviorDimension, w: number) => startTransition(() => router.push(`/analytics/comportamiento?dim=${dim}&weeks=${w}`, { scroll: false }));
  const fmtMoney = (n: number) => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(n);
  const fmtMoneyShort = (n: number) => Math.abs(n) >= 1_000_000 ? "₡" + (n / 1_000_000).toLocaleString(locale === "es" ? "es-CR" : "en-US", { maximumFractionDigits: 1 }) + " M" : fmtMoney(n);
  const dimLabel = t(DIM_LABEL[dimension]);
  const proj = data.projection;
  const max = Math.max(1, ...data.groups.map((x) => x.total));

  const sortGroups = (s: { key: SortKey; dir: "asc" | "desc" } | null) => {
    if (!s) return data.groups;
    const dir = s.dir === "asc" ? 1 : -1;
    return [...data.groups].sort((a, b) => s.key === "label" ? a.label.localeCompare(b.label) * dir : ((a[s.key] as number) - (b[s.key] as number)) * dir);
  };
  const rankGroups = useMemo(() => sortGroups(rankSort), [data.groups, rankSort]); // eslint-disable-line react-hooks/exhaustive-deps
  const detGroups = useMemo(() => sortGroups(detSort), [data.groups, detSort]); // eslint-disable-line react-hooks/exhaustive-deps
  const clickSort = (setter: typeof setRankSort, cur: { key: SortKey; dir: "asc" | "desc" }, key: SortKey) =>
    setter(cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "label" ? "asc" : "desc" });

  const cellNode = (g: BehaviorGroup, c: Col) => {
    const v = g[c.key] as number;
    const muted = c.zero && v === 0;
    if (c.kind === "mttr") return <span style={{ color: muted ? "var(--muted)" : "var(--text)", opacity: muted ? 0.55 : 1 }}>{v}h</span>;
    if (c.kind === "sla") return <span style={{ color: v > 0 ? "var(--st-critical-fg)" : "var(--muted)", opacity: muted ? 0.55 : 1, fontWeight: v > 0 ? 700 : 400 }}>{v}</span>;
    if (c.kind === "cand") return <span style={{ color: v > 0 ? "var(--accent)" : "var(--muted)", opacity: muted ? 0.55 : 1 }}>{v}</span>;
    if (c.kind === "mom") return <span style={{ display: "inline-flex", justifyContent: "flex-end", width: "100%" }}><Momentum v={v} t={t} /></span>;
    if (c.kind === "money") return <span title={fmtMoney(v)} style={{ color: muted ? "var(--muted)" : "var(--text)", opacity: muted ? 0.55 : 1 }}>{fmtMoneyShort(v)}</span>;
    return <span style={{ color: muted ? "var(--muted)" : "var(--text)", opacity: muted ? 0.55 : 1 }}>{v}</span>;
  };

  return (
    <div className="ba">
      <style>{CSS}</style>
      <BackButton fallback="/analytics" />

      <div className="ba-card ba-head">
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--text)", margin: 0, whiteSpace: "nowrap" }}>{t("beh.title")}</h1>
        <InfoTip text={t("beh.subtitle")} />
        <span style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("beh.subtitle")}</span>
      </div>

      {/* Solo VENTANA arriba: gobierna la tendencia (data.trend depende de weeks, no de la dimension). */}
      <div className="ba-controls" style={{ opacity: pending ? 0.6 : 1, transition: "opacity .15s" }}>
        <div className="ba-cg"><span style={lbl}>{t("beh.window")}</span>{WINDOWS.map((w) => <Pill key={w} active={w === weeks} onClick={() => go(dimension, w)}>{w}{t("beh.weeksUnit")}</Pill>)}</div>
      </div>

      <div className="ba-kpis">
        <Kpi label={t("beh.kpi.total")} value={data.total_incidents} />
        <Kpi label={t("beh.kpi.open")} value={data.open_incidents} />
        <Kpi label={t("beh.kpi.groups")} value={data.groups_total} />
        <Kpi label={t("beh.kpi.projection")} value={proj ? proj.next_week : "—"} hint={proj ? (proj.slope > 0 ? "up" : proj.slope < 0 ? "down" : "flat") : undefined} />
        <Kpi label={t("beh.kpi.signals")} value={data.signals.length} danger={data.signals.length > 0} />
      </div>

      {/* §2 Tendencia como banda ancha */}
      <TrendBand data={data} proj={proj} t={t} />

      {/* Agrupar por: gobierna el Ranking / Detalle / Senales (agrupacion por dimension), NO la
          tendencia. Por eso vive aca abajo, junto a lo que controla, y no arriba con la Ventana. */}
      <div className="ba-controls" style={{ opacity: pending ? 0.6 : 1, transition: "opacity .15s" }}>
        <div className="ba-cg"><span style={lbl}>{t("beh.groupBy")}</span>{BEHAVIOR_DIMENSIONS.map((d) => <Pill key={d} active={d === dimension} onClick={() => go(d, weeks)}>{t(DIM_LABEL[d])}</Pill>)}</div>
      </div>

      {/* §1 Ranking: una sola tabla compacta y sortable */}
      <div className="ba-card" style={{ padding: 16 }}>
        <PanelHead title={`${t("beh.ranking")} · ${dimLabel}`} hint={t("beh.sortHint")} />
        {data.groups.length === 0 ? <Empty text={t("beh.empty")} /> : (
          <div className="ba-wrap" style={{ marginTop: 10 }}>
            <table className="ba-t">
              <thead>
                <tr>
                  <Th first label={dimLabel} def={t("beh.def.label")} sort={rankSort} k="label" onClick={() => clickSort(setRankSort, rankSort, "label")} />
                  <Th label={t("beh.col.total")} def={t("beh.def.total")} sort={rankSort} k="total" onClick={() => clickSort(setRankSort, rankSort, "total")} />
                  {RANK_COLS.map((c) => <Th key={c.key} label={t(c.label)} def={t(c.def)} sort={rankSort} k={c.key} onClick={() => clickSort(setRankSort, rankSort, c.key)} />)}
                </tr>
              </thead>
              <tbody>
                {rankGroups.map((g) => (
                  <tr key={g.key}>
                    <td className="ba-first" title={g.label}>{g.label}</td>
                    <td style={{ minWidth: 140 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 40, height: 8, background: "var(--track,var(--paper))", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(g.total / max) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 4 }} /></div>
                        <span style={{ width: 26, textAlign: "right", fontWeight: 700 }}>{g.total}</span>
                      </div>
                    </td>
                    {RANK_COLS.map((c) => <td key={c.key}>{cellNode(g, c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Senales */}
      <div className="ba-card" style={{ padding: 16 }}>
        <PanelHead title={t("beh.signals.title")} hint={t("beh.signals.hint")} />
        {data.signals.length === 0 ? <Empty text={t("beh.signals.empty")} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {data.signals.map((s) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--st-high-bg, var(--paper))", border: "1px solid var(--st-high-border, var(--line))", borderRadius: 10 }}>
                <Icon name="alert" size={16} color="var(--st-high-fg)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>{s.total} {t("beh.cases")} · <Momentum v={s.momentum} t={t} inline /> · {t("beh.score")} {s.avg_transformation_score} · {t("beh.noproblem")}</div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "var(--st-high-fg)", border: "1px solid var(--st-high-border, var(--line))", borderRadius: 8, padding: "4px 9px", background: "var(--card)" }}>{t("beh.considerRC")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* §3 Detalle por grupo: tarjetas legibles + orden funcional */}
      {data.groups.length > 0 && (
        <div className="ba-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("beh.table.title")}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={lbl}>{t("beh.sortby")}</span>
              <select value={detSort?.key ?? ""} onChange={(e) => setDetSort(e.target.value ? { key: e.target.value as SortKey, dir: "desc" } : null)}
                style={{ fontSize: 12, padding: "6px 9px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)" }}>
                <option value="">{dimLabel}</option>
                {DETAIL_COLS.map((c) => <option key={c.key} value={c.key}>{t(c.label)}</option>)}
              </select>
              {detSort && (
                <button onClick={() => setDetSort({ ...detSort, dir: detSort.dir === "asc" ? "desc" : "asc" })} title={t(detSort.dir === "asc" ? "beh.asc" : "beh.desc")} aria-label={t(detSort.dir === "asc" ? "beh.asc" : "beh.desc")} style={{ display: "inline-flex", padding: 6, borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", cursor: "pointer" }}>
                  <Icon name={detSort.dir === "asc" ? "chevron-up" : "chevron-down"} size={13} color="var(--accent-2)" />
                </button>
              )}
            </div>
          </div>
          <div className="ba-cards" style={{ marginTop: 12 }}>
            {detGroups.map((g) => (
              <div key={g.key} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 13, background: "var(--paper)" }}>
                <div title={g.label} style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 10, lineHeight: 1.3, wordBreak: "break-word" }}>{g.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "auto auto", rowGap: 6, columnGap: 12, fontSize: 12 }}>
                  {DETAIL_COLS.map((c) => (
                    <div key={c.key} style={{ display: "contents" }}>
                      <span style={{ color: "var(--muted)" }} title={t(c.def)}>{t(c.label)}</span>
                      <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{cellNode(g, c)}</span>
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

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--muted)" };

function Th({ label, def, sort, k, onClick, first }: { label: string; def: string; sort: { key: SortKey; dir: "asc" | "desc" }; k: SortKey; onClick: () => void; first?: boolean }) {
  const active = sort.key === k;
  return (
    <th className={first ? "ba-first" : undefined} title={def} onClick={onClick} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} style={first ? { textAlign: "left" } : undefined}>
      {label}{active && <Icon name={sort.dir === "asc" ? "chevron-up" : "chevron-down"} size={11} color="var(--accent-2)" style={{ verticalAlign: "-1px", marginLeft: 3 }} />}
    </th>
  );
}

function InfoTip({ text }: { text: string }) {
  return <span title={text} tabIndex={0} aria-label={text} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: "50%", border: "1px solid var(--muted)", color: "var(--muted)", fontSize: 10, fontWeight: 800, cursor: "help", flexShrink: 0, fontFamily: "var(--font-ui)", lineHeight: 1 }}>i</span>;
}
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} aria-pressed={active} style={{ cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 500, padding: "5px 11px", borderRadius: 9, border: active ? "1px solid var(--accent)" : "1px solid var(--line)", background: active ? "var(--accent)" : "var(--card)", color: active ? "var(--on-accent, #fff)" : "var(--text)" }}>{children}</button>;
}
function Kpi({ label, value, hint, danger }: { label: string; value: number | string; hint?: "up" | "down" | "flat"; danger?: boolean }) {
  const hintColor = hint === "up" ? "var(--st-high-fg)" : hint === "down" ? "var(--st-low-fg)" : "var(--muted)";
  return (
    <div className="ba-card" style={{ padding: 13 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 500, fontSize: 22, letterSpacing: "-1px", color: danger ? "var(--st-critical-fg)" : "var(--text)" }}>{value}</span>
        {hint && hint !== "flat" && <Icon name={hint === "up" ? "chevron-up" : "chevron-down"} size={16} color={hintColor} />}
      </div>
    </div>
  );
}
function PanelHead({ title, hint }: { title: string; hint?: string }) {
  return <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</div>{hint && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{hint}</div>}</div>;
}
function Empty({ text }: { text: string }) { return <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "16px 0" }}>{text}</div>; }

function Momentum({ v, t, inline }: { v: number; t: (k: MessageKey) => string; inline?: boolean }) {
  const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
  const color = dir === "up" ? "var(--st-high-fg)" : dir === "down" ? "var(--st-low-fg)" : "var(--muted)";
  const label = dir === "up" ? t("beh.momentum.up") : dir === "down" ? t("beh.momentum.down") : t("beh.momentum.flat");
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color, fontWeight: 600, fontFamily: inline ? undefined : "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{dir !== "flat" && <Icon name={dir === "up" ? "chevron-up" : "chevron-down"} size={13} color={color} />}{inline ? label : (v > 0 ? `+${v}` : String(v))}</span>;
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver((e) => { const cr = e[0].contentRect; setSize({ w: Math.round(cr.width), h: Math.round(cr.height) }); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return { ref, size };
}

function TrendBand({ data, proj, t }: { data: BehaviorAnalysis; proj: BehaviorAnalysis["projection"]; t: (k: MessageKey) => string }) {
  const { ref, size } = useSize();
  const points = data.trend;
  const sum = points.reduce((s, p) => s + p.count, 0);
  const avg = points.length ? Math.round((sum / points.length) * 10) / 10 : 0;
  const projDir = proj ? (proj.slope > 0 ? "up" : proj.slope < 0 ? "down" : "flat") : "flat";
  return (
    <div className="ba-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("beh.trend")}</div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--muted)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, height: 2, background: "var(--accent)", borderRadius: 2 }} />{t("beh.legend.real")}</span>
          {proj && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, height: 0, borderTop: "2px dashed var(--accent)" }} />{t("beh.legend.proj")}</span>}
        </div>
      </div>
      <div className="ba-trendbody" ref={ref}>{size.w > 0 ? <TrendSvg points={points} projection={proj} w={size.w} h={200} /> : (points.length === 0 ? <Empty text="—" /> : null)}</div>
      <div className="ba-micro">
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
    <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px" }}>
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 17, fontWeight: 500, color }}>{value}</span>
        {dir && dir !== "flat" && <Icon name={dir === "up" ? "chevron-up" : "chevron-down"} size={14} color={color} />}
      </div>
    </div>
  );
}

function TrendSvg({ points, projection, w, h }: { points: { week: string; count: number }[]; projection: BehaviorAnalysis["projection"]; w: number; h: number }) {
  if (points.length === 0) return null;
  const padL = 30, padR = 12, padT = 14, padB = 20;
  const iw = Math.max(1, w - padL - padR), ih = Math.max(1, h - padT - padB);
  const projValue = projection ? projection.next_week : null;
  const nSlots = points.length + (projValue != null ? 1 : 0);
  const max = Math.max(1, ...points.map((p) => p.count), projValue ?? 0);
  const X = (i: number) => (nSlots <= 1 ? padL + iw / 2 : padL + (i / (nSlots - 1)) * iw);
  const Y = (v: number) => padT + ih - (v / max) * ih;
  const line = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.count).toFixed(1)}`).join(" ");
  const area = `${line} L${X(points.length - 1).toFixed(1)} ${padT + ih} L${X(0).toFixed(1)} ${padT + ih} Z`;
  const last = points[points.length - 1];
  const yTicks = [0, 1, 2, 3].map((k) => { const v = (max * (3 - k)) / 3; return { v: Math.round(v), y: Y(v) }; });
  const tickEvery = Math.max(1, Math.ceil(points.length / 7)); // <= ~8 ticks, sin encimarse
  const mmdd = (s: string) => (s.length >= 10 ? s.slice(5) : s);
  const gid = "baarea";
  return (
    <svg width={w} height={h} role="img" aria-label="Tendencia semanal" style={{ display: "block" }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".2" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
      {yTicks.map((tk, i) => (<g key={i}><line x1={padL} y1={tk.y} x2={w - padR} y2={tk.y} stroke="var(--line-soft, var(--line))" strokeWidth="1" /><text x={padL - 5} y={tk.y + 3} textAnchor="end" fontSize="9" fill="var(--muted)" fontFamily="var(--font-mono)">{tk.v}</text></g>))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {projValue != null && (<><line x1={X(points.length - 1)} y1={Y(last.count)} x2={X(points.length)} y2={Y(projValue)} stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="4 3" /><circle cx={X(points.length)} cy={Y(projValue)} r="3.5" fill="var(--card)" stroke="var(--accent)" strokeWidth="1.6"><title>{`→ ${projValue}`}</title></circle></>)}
      {points.map((p, i) => (<circle key={i} cx={X(i)} cy={Y(p.count)} r={i === points.length - 1 ? 3.5 : 2.3} fill="var(--accent)"><title>{`${mmdd(p.week)} · ${p.count}`}</title></circle>))}
      {/* anotacion del ultimo punto con offset para no pisar la linea */}
      <text x={X(points.length - 1)} y={Y(last.count) - 8} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--accent-2)" fontFamily="var(--font-mono)">{last.count}</text>
      {points.map((p, i) => (i % tickEvery === 0 || i === points.length - 1) && (<text key={`x${i}`} x={X(i)} y={h - 5} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--font-mono)">{mmdd(p.week)}</text>))}
    </svg>
  );
}
