"use client";

import { useI18n } from "@/lib/i18n/provider";
import { fmtDurationShort, type ClockView } from "@/lib/sla/thresholds";
import { BUCKET_COLOR } from "./bucket-badge";

// Render humano de un reloj SLA (§3.1). NUNCA muestra un % > 100:
//  - vencido  -> badge "Vencido · hace {tiempo}"  (% crudo en el tooltip como evidencia)
//  - en curso -> barra de progreso capada a 100 + % capado, color por umbral 75/90
//  - detenido -> "Cumplido" (a tiempo) o "Vencido" (tarde)
//  - N/A      -> guion
export function SlaClock({ clock }: { clock: ClockView }) {
  const { t } = useI18n();
  if (clock.bucket === "na") return <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>;

  const c = BUCKET_COLOR[clock.bucket];
  const tip = clock.rawPct != null ? `${clock.rawPct}% ${t("sla.clock.elapsedraw")}` : undefined;

  // Reloj detenido y cumplido a tiempo.
  if (!clock.running && clock.met) {
    return (
      <span title={tip} style={badge("var(--st-low-fg)", "var(--st-low-bg)")}>{t("sla.clock.met")}</span>
    );
  }

  // Vencido (corriendo o detenido tarde): lenguaje humano, sin porcentaje absurdo.
  if (clock.overdueMs != null) {
    const ago = t("sla.clock.ago");
    return (
      <span title={tip} style={badge("var(--st-critical-fg)", "var(--st-critical-bg)")}>
        {t("sla.clock.overdue")} · {ago ? `${ago} ` : ""}{fmtDurationShort(clock.overdueMs)}
      </span>
    );
  }

  // En curso, dentro de rango: barra capada a 100 + % capado, color por umbral.
  return (
    <span title={tip} style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span style={{ position: "relative", width: 64, height: 6, borderRadius: 4, background: "var(--track)", overflow: "hidden", flexShrink: 0 }}>
        <span style={{ position: "absolute", inset: 0, width: `${clock.barPct}%`, background: c.fg, borderRadius: 4 }} />
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 11.5, fontWeight: 600, color: c.fg }}>{clock.barPct}%</span>
    </span>
  );
}

function badge(fg: string, bg: string): React.CSSProperties {
  return { fontSize: 10.5, fontWeight: 600, color: fg, background: bg, padding: "3px 9px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap" };
}
