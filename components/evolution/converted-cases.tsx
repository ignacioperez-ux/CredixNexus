"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { BackButton } from "@/components/common/back-button";
import type { ConvertedCase } from "@/lib/evolution/queries";

// Reingenieria orientada al Gerente de Evolucion: pipeline de conversion + "viaje de cada caso".
// Mismo dato del RPC converted_cases(); solo cambia la presentacion. Layout/hover/drawer viven en
// una hoja de estilo acotada por `.cc`.

type DimKey = "converted_to" | "status" | "priority" | "case_type" | "system" | "product" | "process" | "business_unit" | "channel" | "category";
const DIMS: { key: DimKey; label: MessageKey }[] = [
  { key: "converted_to", label: "cc.dim.converted" },
  { key: "status", label: "cc.dim.status" },
  { key: "priority", label: "cc.dim.priority" },
  { key: "case_type", label: "cc.dim.casetype" },
  { key: "system", label: "cc.dim.system" },
  { key: "product", label: "cc.dim.product" },
  { key: "process", label: "cc.dim.process" },
  { key: "business_unit", label: "cc.dim.bu" },
  { key: "channel", label: "cc.dim.channel" },
  { key: "category", label: "cc.dim.category" },
];
const PRESETS: { label: MessageKey; ver: DimKey; seg: DimKey }[] = [
  { label: "cc.preset.system", ver: "system", seg: "converted_to" },
  { label: "cc.preset.area", ver: "business_unit", seg: "converted_to" },
  { label: "cc.preset.state", ver: "converted_to", seg: "status" },
  { label: "cc.preset.process", ver: "process", seg: "converted_to" },
];
const STEPS: MessageKey[] = ["cc.step.case", "cc.step.candidate", "cc.step.recommendation", "cc.step.project"];
const PALETTE = ["var(--accent-2)", "var(--st-eval)", "var(--st-info)", "var(--st-medium)", "var(--st-low)", "var(--st-high)", "var(--st-critical)", "var(--muted)"];
const UNSET = "—";
type Stage = null | "candidate" | "improvement" | "project";

const CSS = `
.cc { display:flex; flex-direction:column; gap:16px; }
.cc .cc-card { background:var(--card); border:1px solid var(--line); border-radius:var(--r-xl); box-shadow:var(--sh-card); }
.cc .cc-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 18px; }
.cc .cc-h1 { font-family:var(--font-display); font-weight:800; font-size:16px; margin:0; color:var(--text); white-space:nowrap; }
.cc .cc-sub { font-size:12.5px; color:var(--muted); flex:1; min-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cc .cc-pipe { display:flex; align-items:stretch; overflow-x:auto; padding-bottom:2px; }
.cc .cc-controls { display:flex; flex-wrap:wrap; gap:10px 14px; align-items:center; }
.cc .cc-select { font-size:12.5px; font-weight:600; padding:8px 30px 8px 11px; border-radius:9px; border:1px solid var(--line); background:var(--card); color:var(--text); cursor:pointer; appearance:none;
  background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%); background-position:calc(100% - 15px) 55%,calc(100% - 10px) 55%; background-size:5px 5px,5px 5px; background-repeat:no-repeat; }
.cc .cc-grid { display:grid; grid-template-columns:1fr; gap:12px; margin-top:10px; }
@media (min-width:1280px){ .cc .cc-grid { grid-template-columns:1fr 1fr; } }
.cc .cc-jcard { text-align:left; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px; cursor:pointer; transition:border-color .12s, box-shadow .12s; display:flex; flex-direction:column; gap:11px; width:100%; }
.cc .cc-jcard:hover { border-color:var(--accent); box-shadow:var(--sh-card); }
.cc .cc-title2 { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; font-size:13.5px; font-weight:600; color:var(--text); line-height:1.35; }
.cc .cc-chip { display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:600; padding:3px 9px; border-radius:var(--r-pill); background:var(--paper); border:1px solid var(--line); color:var(--text); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cc .cc-chartbody { max-height:240px; overflow:auto; margin-top:10px; }
.cc .cc-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.42); z-index:80; }
.cc .cc-drawer { position:fixed; top:0; right:0; height:100dvh; width:min(440px,94vw); background:var(--card); border-left:1px solid var(--line); z-index:81; box-shadow:-10px 0 30px rgba(0,0,0,.2); overflow-y:auto; }
`;

export function ConvertedCasesView({ cases, projectIds = {}, initialVer = "converted_to", initialSeg = "status" }: {
  cases: ConvertedCase[]; projectIds?: Record<string, string>; initialVer?: string; initialSeg?: string;
}) {
  const { t, locale } = useI18n();
  const [ver, setVer] = useState<DimKey>(initialVer as DimKey);
  const [seg, setSeg] = useState<DimKey>(initialSeg as DimKey);
  const [stage, setStage] = useState<Stage>(null);
  const [showChart, setShowChart] = useState(true);
  const [drawer, setDrawer] = useState<ConvertedCase | null>(null);

  const apply = (nextVer: DimKey, nextSeg: DimKey) => {
    setVer(nextVer); setSeg(nextSeg);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `/casos-convertidos?ver=${nextVer}&seg=${nextSeg}`);
  };

  const convLabel = (v: string) => t((v === "project" ? "cc.conv.project" : v === "improvement" ? "cc.conv.improvement" : "cc.conv.candidate") as MessageKey);
  const humanize = (k: DimKey, raw: unknown): string => {
    if (raw == null || String(raw).trim() === "") return UNSET;
    if (k === "converted_to") return convLabel(String(raw));
    if (k === "status") return t(("st." + raw) as MessageKey);
    if (k === "priority") return t(("prio." + raw) as MessageKey);
    return String(raw);
  };
  const dimVal = (c: ConvertedCase, k: DimKey) => humanize(k, c[k]);
  const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString(locale === "es" ? "es-CR" : "en-US", { day: "2-digit", month: "short", year: "2-digit" }) : "—");
  const fmtMoney = (n: number) => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(n);

  const counts = useMemo(() => ({
    total: cases.length,
    candidate: cases.filter((c) => c.converted_to === "candidate").length,
    improvement: cases.filter((c) => c.converted_to === "improvement").length,
    project: cases.filter((c) => c.converted_to === "project").length,
  }), [cases]);

  const filtered = useMemo(() => (stage ? cases.filter((c) => c.converted_to === stage) : cases), [cases, stage]);

  const { groups, stackValues } = useMemo(() => {
    const sv = Array.from(new Set(filtered.map((c) => dimVal(c, seg)))).sort();
    const map = new Map<string, { total: number; segMap: Map<string, number>; rows: ConvertedCase[] }>();
    for (const c of filtered) {
      const g = dimVal(c, ver);
      const s = dimVal(c, seg);
      const e = map.get(g) ?? { total: 0, segMap: new Map<string, number>(), rows: [] as ConvertedCase[] };
      e.total += 1; e.segMap.set(s, (e.segMap.get(s) ?? 0) + 1); e.rows.push(c);
      map.set(g, e);
    }
    const groups = Array.from(map.entries()).map(([value, e]) => ({ value, ...e })).sort((a, b) => b.total - a.total);
    return { groups, stackValues: sv };
  }, [filtered, ver, seg]); // eslint-disable-line react-hooks/exhaustive-deps

  const stackColor = (s: string) => PALETTE[stackValues.indexOf(s) % PALETTE.length];
  const maxTotal = Math.max(1, ...groups.map((g) => g.total));
  const verLabel = t(DIMS.find((d) => d.key === ver)!.label);

  const stages: { key: Stage; label: MessageKey; def: MessageKey; count: number; green?: boolean }[] = [
    { key: null, label: "cc.kpi.total", def: "cc.stage.cases.def", count: counts.total },
    { key: "candidate", label: "cc.conv.candidate", def: "cc.stage.candidate.def", count: counts.candidate },
    { key: "improvement", label: "cc.conv.improvement", def: "cc.stage.improvement.def", count: counts.improvement },
    { key: "project", label: "cc.conv.project", def: "cc.stage.project.def", count: counts.project, green: true },
  ];

  return (
    <div className="cc">
      <style>{CSS}</style>
      <BackButton fallback="/evolucion" />

      {/* 1. Encabezado compacto */}
      <div className="cc-card cc-head">
        <h1 className="cc-h1">{t("cc.title")}</h1>
        <InfoTip text={t("cc.subtitle")} />
        <span className="cc-sub">{t("cc.subtitle")}</span>
      </div>

      {/* 2. Mini-pipeline de conversion (reemplaza los KPI) */}
      <div className="cc-card" style={{ padding: 16 }}>
        <div className="cc-pipe">
          {stages.map((s, i) => {
            const active = stage === s.key;
            const color = s.green ? "var(--st-low-fg)" : "var(--accent)";
            return (
              <div key={String(s.key)} style={{ display: "flex", alignItems: "stretch", flex: "1 1 130px", minWidth: 130 }}>
                <button onClick={() => setStage(s.key)} title={t(s.def)}
                  style={{ flex: 1, textAlign: "left", cursor: "pointer", background: active ? (s.green ? "var(--st-low-bg)" : "var(--accent-soft)") : "var(--card-2, var(--paper))", border: active ? `1px solid ${color}` : "1px solid var(--line)", borderLeft: i === 0 && !active ? "1px solid var(--line)" : undefined, padding: "11px 14px", borderRadius: i === 0 ? "10px 0 0 10px" : i === stages.length - 1 ? "0 10px 10px 0" : 0, display: "block" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3px", color: active ? color : "var(--muted)" }}>{t(s.label)}</span>
                    <InfoTip text={t(s.def)} small />
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 30, fontWeight: 500, letterSpacing: "-1.5px", color: s.green ? "var(--st-low-fg)" : "var(--text)", marginTop: 2, lineHeight: 1.05 }}>{s.count}</div>
                </button>
                {i < stages.length - 1 && <div style={{ display: "flex", alignItems: "center", margin: "0 -6px", zIndex: 1 }}><Icon name="chevron-right" size={14} color="var(--muted)" /></div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Controles: presets + dos selectores */}
      <div className="cc-controls">
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--muted)" }}>{t("cc.presets")}</span>
        {PRESETS.map((p) => {
          const on = ver === p.ver && seg === p.seg;
          return (
            <button key={p.label} onClick={() => apply(p.ver, p.seg)} aria-pressed={on}
              style={{ cursor: "pointer", fontSize: 12, fontWeight: on ? 700 : 500, padding: "7px 12px", borderRadius: 999, border: on ? "1px solid var(--accent)" : "1px solid var(--line)", background: on ? "var(--accent)" : "var(--card)", color: on ? "var(--on-accent, #fff)" : "var(--text)" }}>
              {t(p.label)}
            </button>
          );
        })}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <label style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>{t("cc.viewby")}</label>
          <select className="cc-select" value={ver} onChange={(e) => apply(e.target.value as DimKey, seg)}>
            {DIMS.map((d) => <option key={d.key} value={d.key}>{t(d.label)}</option>)}
          </select>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <label style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>{t("cc.segby")}</label>
          <select className="cc-select" value={seg} onChange={(e) => apply(ver, e.target.value as DimKey)}>
            {DIMS.map((d) => <option key={d.key} value={d.key}>{t(d.label)}</option>)}
          </select>
        </div>
      </div>

      {/* 4. Distribucion (apoyo, colapsable) */}
      <div className="cc-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("cc.chart")} · {verLabel}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{t("cc.chart.hint")}</div>
          </div>
          <button onClick={() => setShowChart((v) => !v)} style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, color: "var(--accent-2)", background: "transparent", border: "1px solid var(--line)", borderRadius: 8, padding: "5px 10px" }}>
            {showChart ? t("cc.hide") : t("cc.show")}
          </button>
        </div>
        {showChart && (groups.length === 0 ? <Empty text={t("cc.empty")} /> : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
              {stackValues.map((s) => (
                <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: stackColor(s) }} />{s}
                </span>
              ))}
            </div>
            <div className="cc-chartbody" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groups.map((g) => (
                <div key={g.value} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 140, flexShrink: 0, fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.value}>{g.value}</span>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", height: 14, borderRadius: 5, overflow: "hidden", background: "var(--track, var(--paper))", width: `${(g.total / maxTotal) * 100}%`, minWidth: 3 }}>
                      {stackValues.map((s) => { const v = g.segMap.get(s) ?? 0; return v > 0 ? <div key={s} title={`${s}: ${v}`} style={{ flex: v, background: stackColor(s), marginRight: 1 }} /> : null; })}
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 11.5, fontWeight: 700, color: "var(--text)", flexShrink: 0, whiteSpace: "nowrap" }}>
                      {g.total} · {Math.round((g.total / Math.max(1, filtered.length)) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ))}
      </div>

      {/* 5. Viaje de cada caso */}
      <div className="cc-card" style={{ padding: 20 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t("cc.journey")}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{t("cc.journey.hint")}</div>
        {groups.length === 0 ? <Empty text={t("cc.empty")} /> : groups.map((g) => (
          <div key={g.value} style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--muted)" }}>{verLabel}: {g.value} · {g.total}</div>
            <div className="cc-grid">
              {g.rows.map((c) => (
                <JourneyCard key={c.id} c={c} t={t} fmtDate={fmtDate} humanize={humanize} projectId={c.project_code ? projectIds[c.project_code] : undefined} onOpen={() => setDrawer(c)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {drawer && (
        <CaseDrawer c={drawer} t={t} fmtDate={fmtDate} fmtMoney={fmtMoney} convLabel={convLabel} projectId={drawer.project_code ? projectIds[drawer.project_code] : undefined} onClose={() => setDrawer(null)} />
      )}
    </div>
  );
}

function reachedOf(c: ConvertedCase) { return c.converted_to === "project" ? 4 : c.converted_to === "improvement" ? 3 : 2; }

function Stepper({ c, t }: { c: ConvertedCase; t: (k: MessageKey) => string }) {
  const reached = reachedOf(c);
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {STEPS.map((s, idx) => {
        const n = idx + 1; const on = n <= reached; const isProj = n === 4;
        const col = on ? (isProj ? "var(--st-low-fg)" : "var(--accent)") : "var(--line)";
        return (
          <Fragment key={s}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: 62 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: on ? col : "transparent", border: `1.5px solid ${on ? col : "var(--line)"}`, flexShrink: 0 }} />
              <span style={{ fontSize: 9, textAlign: "center", color: on ? "var(--text)" : "var(--muted)", fontWeight: on ? 700 : 500, lineHeight: 1.15 }}>{t(s)}</span>
            </div>
            {idx < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: n + 1 <= reached ? "var(--accent)" : "var(--line)", marginTop: 4 }} />}
          </Fragment>
        );
      })}
    </div>
  );
}

function JourneyCard({ c, t, fmtDate, humanize, projectId, onOpen }: {
  c: ConvertedCase; t: (k: MessageKey) => string; fmtDate: (v: string | null) => string;
  humanize: (k: DimKey, raw: unknown) => string; projectId?: string; onOpen: () => void;
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const chips: { k: DimKey; v: string | null }[] = [
    { k: "system", v: c.system }, { k: "business_unit", v: c.business_unit }, { k: "process", v: c.process },
    { k: "priority", v: c.priority }, { k: "channel", v: c.channel },
  ];
  return (
    <div className="cc-jcard" role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
      {/* Linea 1 */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <Link href={`/incidents/${c.id}`} onClick={stop} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-2)", textDecoration: "none", fontWeight: 700 }}>{c.incident_number}</Link>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)" }}>{fmtDate(c.opened_at)}</span>
          </div>
          <div className="cc-title2" title={c.title}>{c.title}</div>
        </div>
      </div>
      {/* Linea 2: stepper + chip proyecto */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}><Stepper c={c} t={t} /></div>
        {c.converted_to === "project" && c.project_code && (
          <Link href={projectId ? `/projects/${projectId}` : "/projects"} onClick={stop}
            style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, color: "var(--st-low-fg)", background: "var(--st-low-bg)", border: "1px solid var(--st-low-border, var(--line))", borderRadius: "var(--r-pill)", padding: "3px 9px", textDecoration: "none" }}>
            {c.project_code}
          </Link>
        )}
      </div>
      {/* Linea 3: chips de dimensiones + ancla */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {c.status === "in_evolution" && (
          <span className="cc-chip" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--accent-2)" }}>{t("st.in_evolution")}</span>
        )}
        {chips.filter((ch) => ch.v && String(ch.v).trim() !== "").map((ch) => (
          <span key={ch.k} className="cc-chip" title={t(DIMS.find((d) => d.key === ch.k)!.label)}>{humanize(ch.k, ch.v)}</span>
        ))}
      </div>
    </div>
  );
}

function CaseDrawer({ c, t, fmtDate, fmtMoney, convLabel, projectId, onClose }: {
  c: ConvertedCase; t: (k: MessageKey) => string; fmtDate: (v: string | null) => string; fmtMoney: (n: number) => string;
  convLabel: (v: string) => string; projectId?: string; onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const dims: { label: MessageKey; value: string | null }[] = [
    { label: "cc.dim.system", value: c.system }, { label: "cc.dim.product", value: c.product }, { label: "cc.dim.process", value: c.process },
    { label: "cc.dim.bu", value: c.business_unit }, { label: "cc.dim.channel", value: c.channel }, { label: "cc.dim.category", value: c.category },
    { label: "cc.dim.casetype", value: c.case_type },
  ];
  return (
    <>
      <div className="cc-backdrop" onClick={onClose} />
      <aside className="cc-drawer" role="dialog" aria-modal="true">
        <div style={{ position: "sticky", top: 0, background: "var(--card)", borderBottom: "1px solid var(--line)", padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--accent-2)", fontWeight: 700 }}>{c.incident_number}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginTop: 3, lineHeight: 1.35 }}>{c.title}</div>
          </div>
          <button onClick={onClose} aria-label={t("cc.close")} style={{ cursor: "pointer", background: "transparent", border: "1px solid var(--line)", borderRadius: 8, padding: 6, color: "var(--muted)", lineHeight: 0 }}><Icon name="x" size={15} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          <Stepper c={c} t={t} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
            <Field label={t("cc.col.reporter")} value={c.reporter ?? "—"} />
            <Field label={t("cc.dim.priority")} value={t(("prio." + c.priority) as MessageKey)} />
            <Field label={t("cc.col.opened")} value={fmtDate(c.opened_at)} mono />
            <Field label={t("cc.col.resolved")} value={fmtDate(c.resolved_at)} mono />
            <Field label={t("cc.dim.status")} value={t(("st." + c.status) as MessageKey)} />
            <Field label={t("cc.dim.converted")} value={convLabel(c.converted_to)} />
            <Field label={t("cc.field.score")} value={String(c.transformation_score)} mono />
            <Field label={t("cc.field.partners")} value={String(c.partners)} mono />
            <Field label={t("cc.field.financial")} value={fmtMoney(c.financial_impact)} mono />
          </div>

          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--muted)", marginBottom: 8 }}>{t("cc.field.dims")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
              {dims.map((d) => <Field key={d.label} label={t(d.label)} value={d.value && String(d.value).trim() !== "" ? String(d.value) : "—"} />)}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <Link href={`/incidents/${c.id}`} className="cx-lift" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 12.5, fontWeight: 700, color: "var(--text)", border: "1px solid var(--line)", borderRadius: 9, padding: "8px 13px", background: "var(--card)" }}>
              <Icon name="link" size={13} /> {t("cc.openCase")}
            </Link>
            {c.converted_to === "project" && c.project_code && (
              <Link href={projectId ? `/projects/${projectId}` : "/projects"} style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 12.5, fontWeight: 700, color: "var(--st-low-fg)", border: "1px solid var(--st-low-border, var(--line))", borderRadius: 9, padding: "8px 13px", background: "var(--st-low-bg)" }}>
                <Icon name="link" size={13} color="var(--st-low-fg)" /> {t("cc.openProject")} · {c.project_code}
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : undefined, fontVariantNumeric: mono ? "tabular-nums" : undefined, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function InfoTip({ text, small }: { text: string; small?: boolean }) {
  const s = small ? 12 : 15;
  return (
    <span title={text} tabIndex={0} aria-label={text}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: s, height: s, borderRadius: "50%", border: "1px solid var(--muted)", color: "var(--muted)", fontSize: small ? 8 : 10, fontWeight: 800, cursor: "help", flexShrink: 0, fontFamily: "var(--font-ui)", lineHeight: 1 }}>i</span>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "18px 0" }}>{text}</div>;
}
