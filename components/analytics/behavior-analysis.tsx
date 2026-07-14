"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { BEHAVIOR_DIMENSIONS, type BehaviorAnalysis, type BehaviorDimension, type BehaviorGroup } from "@/lib/analytics/queries";

const DIM_LABEL: Record<BehaviorDimension, MessageKey> = {
  category: "beh.dim.category", product: "beh.dim.product", service: "beh.dim.service",
  business_unit: "beh.dim.business_unit", channel: "beh.dim.channel", process: "beh.dim.process", priority: "beh.dim.priority",
};
const WINDOWS = [4, 8, 12, 26, 52];

export function BehaviorAnalysisView({ data, dimension, weeks }: { data: BehaviorAnalysis; dimension: BehaviorDimension; weeks: number }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (dim: BehaviorDimension, w: number) =>
    startTransition(() => router.push(`/analytics/comportamiento?dim=${dim}&weeks=${w}`));

  const fmtMoney = (n: number) => new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(n);
  const dimLabel = t(DIM_LABEL[dimension]);
  const proj = data.projection;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, opacity: pending ? 0.6 : 1, transition: "opacity .15s" }}>
      {/* Encabezado */}
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "var(--text)", margin: 0 }}>{t("beh.title")}</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0", maxWidth: 720 }}>{t("beh.subtitle")}</p>
      </div>

      {/* Controles: dimension + ventana */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <Control label={t("beh.groupBy")}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {BEHAVIOR_DIMENSIONS.map((d) => (
              <Pill key={d} active={d === dimension} onClick={() => go(d, weeks)}>{t(DIM_LABEL[d])}</Pill>
            ))}
          </div>
        </Control>
        <Control label={t("beh.window")}>
          <div style={{ display: "flex", gap: 6 }}>
            {WINDOWS.map((w) => (
              <Pill key={w} active={w === weeks} onClick={() => go(dimension, w)}>{w}{t("beh.weeksUnit")}</Pill>
            ))}
          </div>
        </Control>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Kpi label={t("beh.kpi.total")} value={data.total_incidents} />
        <Kpi label={t("beh.kpi.open")} value={data.open_incidents} />
        <Kpi label={t("beh.kpi.groups")} value={data.groups_total} />
        <Kpi
          label={t("beh.kpi.projection")}
          value={proj ? proj.next_week : "—"}
          hint={proj ? (proj.slope > 0 ? "up" : proj.slope < 0 ? "down" : "flat") : undefined}
        />
        <Kpi label={t("beh.kpi.signals")} value={data.signals.length} danger={data.signals.length > 0} />
      </div>

      {/* Ranking por dimension + tendencia */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1fr)", gap: 16 }}>
        <Panel title={`${t("beh.ranking")} · ${dimLabel}`} hint={t("beh.ranking.hint")}>
          {data.groups.length === 0
            ? <Empty text={t("beh.empty")} />
            : <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                {data.groups.map((g) => <BarRow key={g.key} g={g} max={Math.max(1, ...data.groups.map((x) => x.total))} t={t} />)}
              </div>}
          {data.groups_total > data.groups.length && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
              {t("beh.showing")} {data.groups.length} / {data.groups_total}
            </div>
          )}
        </Panel>

        <Panel title={t("beh.trend")} hint={proj ? t("beh.trend.proj") : undefined}>
          <TrendChart points={data.trend} projection={proj} />
        </Panel>
      </div>

      {/* Senales de causa-raiz (centro proactivo) */}
      <Panel title={t("beh.signals.title")} hint={t("beh.signals.hint")}>
        {data.signals.length === 0
          ? <Empty text={t("beh.signals.empty")} />
          : <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {data.signals.map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "var(--st-high-bg, var(--paper))", border: "1px solid var(--st-high-border, var(--line))", borderRadius: 12 }}>
                  <Icon name="alert" size={18} color="var(--st-high-fg)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {s.total} {t("beh.cases")} · <Momentum v={s.momentum} t={t} inline /> · {t("beh.score")} {s.avg_transformation_score} · {t("beh.noproblem")}
                    </div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "var(--st-high-fg)", border: "1px solid var(--st-high-border, var(--line))", borderRadius: 8, padding: "5px 10px", background: "var(--card)" }}>
                    {t("beh.considerRC")}
                  </span>
                </div>
              ))}
            </div>}
      </Panel>

      {/* Detalle numerico (accesibilidad: tabla, no solo color) */}
      {data.groups.length > 0 && (
        <Panel title={t("beh.table.title")}>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "right", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
                  <Th align="left">{dimLabel}</Th>
                  <Th>{t("beh.col.total")}</Th><Th>{t("beh.col.open")}</Th><Th>{t("beh.col.mttr")}</Th>
                  <Th>{t("beh.col.sla")}</Th><Th>{t("beh.col.cand")}</Th><Th>{t("beh.col.problem")}</Th>
                  <Th>{t("beh.col.momentum")}</Th><Th>{t("beh.col.financial")}</Th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g) => (
                  <tr key={g.key} style={{ borderBottom: "1px solid var(--line-soft, var(--line))" }}>
                    <Td align="left" strong>{g.label}</Td>
                    <Td>{g.total}</Td><Td>{g.open}</Td><Td>{g.mttr_hours}h</Td>
                    <Td danger={g.sla_breached > 0}>{g.sla_breached}</Td>
                    <Td>{g.transformation_candidates}</Td><Td>{g.with_problem}</Td>
                    <Td><Momentum v={g.momentum} t={t} /></Td>
                    <Td>{fmtMoney(g.financial_impact)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--muted)", marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );
}
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      cursor: "pointer", fontSize: 12.5, fontWeight: active ? 700 : 500, padding: "6px 12px", borderRadius: 9,
      border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
      background: active ? "var(--accent-soft)" : "var(--card)", color: active ? "var(--accent)" : "var(--text)",
    }}>{children}</button>
  );
}
function Kpi({ label, value, hint, danger }: { label: string; value: number | string; hint?: "up" | "down" | "flat"; danger?: boolean }) {
  const hintColor = hint === "up" ? "var(--st-high-fg)" : hint === "down" ? "var(--st-low-fg)" : "var(--muted)";
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 24, letterSpacing: "-1px", color: danger ? "var(--st-critical-fg)" : "var(--text)" }}>{value}</span>
        {hint && hint !== "flat" && <Icon name={hint === "up" ? "chevron-up" : "chevron-down"} size={18} color={hintColor} />}
      </div>
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
function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "18px 0" }}>{text}</div>;
}
function Th({ children, align = "right" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th style={{ textAlign: align, padding: "8px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, align = "right", strong, danger }: { children: React.ReactNode; align?: "left" | "right"; strong?: boolean; danger?: boolean }) {
  return <td style={{ textAlign: align, padding: "8px 10px", fontFamily: align === "right" ? "var(--font-mono)" : undefined, fontWeight: strong ? 700 : 400, color: danger ? "var(--st-critical-fg)" : "var(--text)", whiteSpace: "nowrap" }}>{children}</td>;
}

/** Momentum: recientes - anteriores (mitad de ventana). Flecha + color (nunca solo color). */
function Momentum({ v, t, inline }: { v: number; t: (k: MessageKey) => string; inline?: boolean }) {
  const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
  const color = dir === "up" ? "var(--st-high-fg)" : dir === "down" ? "var(--st-low-fg)" : "var(--muted)";
  const label = dir === "up" ? t("beh.momentum.up") : dir === "down" ? t("beh.momentum.down") : t("beh.momentum.flat");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color, fontWeight: 600, fontFamily: inline ? undefined : "var(--font-mono)" }}>
      {dir !== "flat" && <Icon name={dir === "up" ? "chevron-up" : "chevron-down"} size={13} color={color} />}
      {inline ? label : (v > 0 ? `+${v}` : String(v))}
    </span>
  );
}

/** Barra horizontal por grupo: total + badges de metricas secundarias. */
function BarRow({ g, max, t }: { g: BehaviorGroup; max: number; t: (k: MessageKey) => string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 150, flexShrink: 0, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.label}>{g.label}</span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 10, background: "var(--track, var(--paper))", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ width: `${(g.total / max) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 5 }} />
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", width: 28, textAlign: "right" }}>{g.total}</span>
      </div>
      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
        <Badge label={t("beh.col.open")} value={g.open} />
        {g.sla_breached > 0 && <Badge label={t("beh.col.sla")} value={g.sla_breached} danger />}
        {g.transformation_candidates > 0 && <Badge label={t("beh.col.cand")} value={g.transformation_candidates} accent />}
        {g.momentum !== 0 && <Momentum v={g.momentum} t={t} />}
      </div>
    </div>
  );
}
function Badge({ label, value, danger, accent }: { label: string; value: number; danger?: boolean; accent?: boolean }) {
  const color = danger ? "var(--st-critical-fg)" : accent ? "var(--accent)" : "var(--muted)";
  return (
    <span title={label} style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, color, border: `1px solid ${danger ? "var(--st-critical-border, var(--line))" : "var(--line)"}`, borderRadius: 6, padding: "2px 6px" }}>
      {value}
    </span>
  );
}

/** Tendencia semanal (area + linea) con punto de proyeccion (guion). Dato real del RPC. */
function TrendChart({ points, projection }: { points: { week: string; count: number }[]; projection: BehaviorAnalysis["projection"] }) {
  if (points.length === 0) return <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>—</div>;
  const W = 560, H = 160, pad = 10;
  const projValue = projection ? projection.next_week : null;
  const nSlots = points.length + (projValue != null ? 1 : 0);
  const max = Math.max(1, ...points.map((p) => p.count), projValue ?? 0);
  const x = (i: number) => nSlots <= 1 ? W / 2 : pad + (i / (nSlots - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.count).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  const last = points[points.length - 1];
  const grid = [0.25, 0.5, 0.75].map((g) => H - pad - g * (H - pad * 2));
  const mmdd = (s: string) => (s.length >= 10 ? s.slice(5) : s);
  return (
    <div style={{ marginTop: 10 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", height: "auto", overflow: "visible" }} role="img" aria-label="Tendencia semanal">
        <defs><linearGradient id="beharea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".24" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
        {grid.map((gy, i) => <line key={i} x1="0" y1={gy} x2={W} y2={gy} stroke="var(--line-soft, var(--line))" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <path d={area} fill="url(#beharea)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(points.length - 1)} cy={y(last.count)} r="3.5" fill="var(--accent)" />
        {projValue != null && (
          <>
            <line x1={x(points.length - 1)} y1={y(last.count)} x2={x(points.length)} y2={y(projValue)} stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            <circle cx={x(points.length)} cy={y(projValue)} r="3.5" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
          </>
        )}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
        <span>{mmdd(points[0].week)}</span>
        <span style={{ color: "var(--accent)", fontWeight: 700 }}>{mmdd(last.week)} · {last.count}</span>
      </div>
    </div>
  );
}
