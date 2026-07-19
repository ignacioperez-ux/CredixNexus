"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { RecurrenceAnalytics } from "@/lib/analytics/queries";

// Reincidencia y efectividad de fixes (Gerencia de Operaciones). Datos reales del RPC
// recurrence_analytics (ventana por defecto 90 dias). Metrica aproximada de efectividad.

export function RecurrencePanel({ data }: { data?: RecurrenceAnalytics }) {
  const { t } = useI18n();
  if (!data) return <Empty text={t("an.rec.unavailable")} />;
  const rateColor = data.rate_pct >= 20 ? "var(--st-critical-fg)" : data.rate_pct >= 10 ? "var(--st-high-fg)" : "var(--st-low-fg)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.rec.intro").replace("{d}", String(data.window_days))}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <Kpi label={t("an.rec.rate")} value={`${data.rate_pct}%`} color={rateColor} />
        <Kpi label={t("an.rec.count")} value={String(data.recurrences)} />
        <Kpi label={t("an.rec.total")} value={String(data.total)} />
      </div>

      {/* Efectividad por operador: fixes que reaparecieron */}
      <Card title={t("an.rec.byop.title")} hint={t("an.rec.byop.hint")}>
        {data.by_operator.length === 0 ? <Empty text={t("an.rec.byop.empty")} /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
              <thead>
                <tr>
                  <Th>{t("an.rec.col.operator")}</Th>
                  <Th right>{t("an.rec.col.resolved")}</Th>
                  <Th right>{t("an.rec.col.cameback")}</Th>
                  <Th right>{t("an.rec.col.effectiveness")}</Th>
                </tr>
              </thead>
              <tbody>
                {data.by_operator.map((o, i) => {
                  const eff = o.effectiveness_pct;
                  const effColor = eff == null ? "var(--muted)" : eff >= 90 ? "var(--st-low-fg)" : eff >= 75 ? "var(--st-high-fg)" : "var(--st-critical-fg)";
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--line-soft)" }}>
                      <Td>{o.name}</Td>
                      <Td right mono>{o.resolved}</Td>
                      <Td right mono style={{ color: o.came_back > 0 ? "var(--st-critical-fg)" : "var(--muted)", fontWeight: o.came_back > 0 ? 700 : 400 }}>{o.came_back}</Td>
                      <Td right mono style={{ color: effColor, fontWeight: 700 }}>{eff == null ? "—" : `${eff}%`}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Reincidencia por categoria: senal de mejora mayor */}
      <Card title={t("an.rec.bycat.title")} hint={t("an.rec.bycat.hint")}>
        {data.by_category.length === 0 ? <Empty text={t("an.rec.bycat.empty")} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(() => {
              const max = Math.max(1, ...data.by_category.map((c) => c.recurrences));
              return data.by_category.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12.5, color: "var(--text)", width: 160, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.category}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 20, background: "var(--track, var(--paper))", overflow: "hidden" }}>
                    <div style={{ width: `${(c.recurrences / max) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 20 }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", width: 30, textAlign: "right" }}>{c.recurrences}</span>
                </div>
              ));
            })()}
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 26, letterSpacing: "-1px", color: color ?? "var(--text)" }}>{value}</div>
    </div>
  );
}
function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, marginBottom: 10 }}>{hint}</div>}
      <div style={{ marginTop: hint ? 0 : 10 }}>{children}</div>
    </div>
  );
}
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ textAlign: right ? "right" : "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3px", color: "var(--muted)", padding: "6px 10px", whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, right, mono, style }: { children: React.ReactNode; right?: boolean; mono?: boolean; style?: React.CSSProperties }) {
  return <td style={{ textAlign: right ? "right" : "left", padding: "8px 10px", color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", fontVariantNumeric: mono ? "tabular-nums" : undefined, ...style }}>{children}</td>;
}
function Empty({ text }: { text: string }) { return <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "14px 0" }}>{text}</div>; }
