"use client";

import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { clockView, fmtDurationLong } from "@/lib/sla/thresholds";
import type { MessageKey } from "@/lib/i18n/dictionaries";

// Fuente UNICA de la presentacion del reloj SLA en el detalle y el panel rapido (C4). Elimina las
// tres definiciones divergentes de "settled/breached" que producian estados contradictorios
// ("En tiempo" + "Vencido hace 5 d"). Semaforo + tiempo humano + fecha objetivo; el % crudo queda
// en el tooltip. Estados: En tiempo / Por vencer / Vencido / Cumplido / En Evolucion (pausa) / —.
const DONE = ["resolved", "closed"];

type View = { label: MessageKey; color: string; bg: string; time: string; tip?: string };

function computeView(t: (k: MessageKey) => string, openedAt: string, dueAt: string | null, resolvedAt: string | null, status: string): View | null {
  if (!dueAt || status === "cancelled") return null;
  const now = Date.now();

  // En Evolucion: el caso es ancla, la mesa mantiene el tracking; el reloj SLA queda en PAUSA.
  if (status === "in_evolution") {
    return { label: "sla.clock.paused", color: "var(--teal)", bg: "var(--teal-soft)", time: "" };
  }

  // Resuelto/Cerrado: reloj detenido. Cumplido (a tiempo) o Vencido (tarde).
  if (DONE.includes(status)) {
    if (!resolvedAt) return { label: "sla.clock.met", color: "var(--st-low-fg)", bg: "var(--st-low-bg)", time: "" };
    const cv = clockView(openedAt, dueAt, resolvedAt, now);
    if (cv.met) return { label: "sla.clock.met", color: "var(--st-low-fg)", bg: "var(--st-low-bg)", time: "", tip: cv.rawPct != null ? `${cv.rawPct}%` : undefined };
    return { label: "sla.clock.overdue", color: "var(--st-critical-fg)", bg: "var(--st-critical-bg)", time: cv.overdueMs != null ? `${t("sla.clock.ago")} ${fmtDurationLong(cv.overdueMs)}`.trim() : "", tip: cv.rawPct != null ? `${cv.rawPct}%` : undefined };
  }

  // Activo: semaforo por umbral.
  const cv = clockView(openedAt, dueAt, null, now);
  const tip = cv.rawPct != null ? `${cv.rawPct}%` : undefined;
  if (cv.overdueMs != null) {
    return { label: "sla.clock.overdue", color: "var(--st-critical-fg)", bg: "var(--st-critical-bg)", time: `${t("sla.clock.ago")} ${fmtDurationLong(cv.overdueMs)}`.trim(), tip };
  }
  const remaining = new Date(dueAt).getTime() - now;
  const time = `${t("sla.clock.dueIn")} ${fmtDurationLong(remaining)}`;
  if (cv.bucket === "warning" || cv.bucket === "critical") {
    return { label: "sla.clock.duesoon", color: "var(--st-high-fg)", bg: "var(--st-high-bg)", time, tip };
  }
  return { label: "sla.clock.ontime", color: "var(--st-low-fg)", bg: "var(--st-low-bg)", time, tip };
}

function badge(v: View, t: (k: MessageKey) => string) {
  return (
    <span title={v.tip} style={{ fontSize: 10.5, fontWeight: 600, color: v.color, background: v.bg, padding: "3px 9px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap" }}>{t(v.label)}</span>
  );
}

/** Version compacta (panel rapido / listas): badge + tiempo humano en linea. */
export function SlaStatusInline({ openedAt, dueAt, resolvedAt, status }: { openedAt: string; dueAt: string | null; resolvedAt: string | null; status: string }) {
  const { t } = useI18n();
  const v = computeView(t, openedAt, dueAt, resolvedAt, status);
  if (!v) return <span style={{ color: "var(--muted)" }}>—</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {badge(v, t)}
      {v.time && <span style={{ fontSize: 11.5, fontWeight: 600, color: v.color }}>{v.time}</span>}
    </span>
  );
}

/** Fila del detalle: etiqueta + semaforo + tiempo + fecha objetivo. */
export function SlaStatusRow({ label, openedAt, dueAt, resolvedAt, status, locale, last }: { label: string; openedAt: string; dueAt: string | null; resolvedAt: string | null; status: string; locale: string; last?: boolean }) {
  const { t } = useI18n();
  const v = computeView(t, openedAt, dueAt, resolvedAt, status);
  const border = last ? {} : { borderBottom: "1px solid var(--line-soft)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "10px 0", ...border }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
        {v ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {badge(v, t)}
            {v.time && <span style={{ fontSize: 11.5, fontWeight: 600, color: v.color }}>{v.time}</span>}
          </span>
        ) : <span style={{ fontSize: 12.5, color: "var(--muted)" }}>—</span>}
      </div>
      {dueAt && status !== "cancelled" && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          <Icon name="flag" size={10} color="var(--muted)" /> {new Date(dueAt).toLocaleString(locale)}
        </div>
      )}
    </div>
  );
}
