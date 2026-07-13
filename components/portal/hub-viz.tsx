"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { statusColors } from "@/lib/incidents/labels";

// Lenguaje de datos del Hub del Usuario (Sub-Fase 1.2 Bloque A).
// Regla dura de color (validada con dataviz): los colores de estado son STATUS colors:
// siempre color + icono/etiqueta + gap de 2px, nunca color solo. Cero dato inventado:
// el anillo se alimenta de sla_resolution_due_at/opened_at reales; el donut, de conteos reales.

const SETTLED = ["resolved", "closed", "cancelled"];

/** Duracion compacta (unidades neutras). now/due en ms. */
function compact(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min <= 0) return "0m";
  if (min >= 1440) return `${Math.round(min / 1440)}d`;
  if (min >= 60) return `${Math.round(min / 60)}h`;
  return `${min}m`;
}

/**
 * Anillo de progreso SLA. Sustituye el texto plano de vencimiento por una marca grafica
 * con explicacion (tooltip). Se calcula en cliente tras montar para evitar mismatch de
 * hidratacion por el reloj.
 */
export function SlaRing({
  openedAt, dueAt, status, resolvedAt, size = 46, label,
}: {
  openedAt: string; dueAt: string | null; status: string; resolvedAt?: string | null; size?: number; label?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const stroke = 5;

  const settled = SETTLED.includes(status) || !!resolvedAt;
  const opened = new Date(openedAt).getTime();
  const due = dueAt ? new Date(dueAt).getTime() : null;

  // Estado del anillo: resuelto (verde+check), sin SLA (neutro), o progreso vivo.
  let frac = 0;               // fraccion de tiempo consumida (0..1)
  let color = "var(--accent)";
  let center: React.ReactNode = "—";
  let tip = label ?? "";

  if (settled) {
    frac = 1;
    color = "var(--st-low-fg)";
    center = <Icon name="check" size={Math.round(size * 0.34)} color="var(--st-low-fg)" />;
    tip = tip || "Caso resuelto";
  } else if (due === null) {
    frac = 0;
    color = "var(--muted)";
    center = <span style={{ fontSize: size * 0.24, color: "var(--muted)" }}>—</span>;
    tip = tip || "Sin SLA definido";
  } else if (now !== null) {
    const window = Math.max(due - opened, 1);
    const consumed = now - opened;
    frac = Math.min(Math.max(consumed / window, 0), 1);
    const remaining = due - now;
    const overdue = remaining <= 0;
    const near = !overdue && remaining < window * 0.2;
    color = overdue ? "var(--st-critical-fg)" : near ? "var(--st-high-fg)" : "var(--accent)";
    center = overdue
      ? <Icon name="alert" size={Math.round(size * 0.32)} color="var(--st-critical-fg)" />
      : <span style={{ fontFamily: "var(--font-mono)", fontSize: size * 0.26, fontWeight: 600, color }}>{compact(remaining)}</span>;
    tip = overdue ? "SLA vencido" : `SLA: ${compact(remaining)} restante`;
  } else {
    // Pre-montaje: solo pista, sin dato dependiente del reloj.
    center = <span style={{ fontSize: size * 0.24, color: "var(--muted)" }}>·</span>;
  }

  const dash = c * frac;

  return (
    <span title={tip} aria-label={tip} role="img" style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "inline-grid", placeItems: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--viz-ring-track, var(--track))" strokeWidth={stroke} />
        {frac > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} style={{ transition: "stroke-dasharray var(--t-base, 200ms)" }} />
        )}
      </svg>
      <span style={{ position: "relative", display: "grid", placeItems: "center" }}>{center}</span>
    </span>
  );
}

export type StatusSlice = { status: string; count: number };

/**
 * Donut de casos por estado. Sustituye los contadores planos. Cada segmento lleva su
 * color de estado con gap de 2px; la identidad NUNCA depende solo del color: la leyenda
 * adjunta muestra dot + etiqueta + conteo (triple senal).
 */
export function StatusDonut({ slices, total, size = 132, labelOf }: {
  slices: StatusSlice[]; total: number; size?: number; labelOf: (s: string) => string;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = 2; // px de separacion entre segmentos (regla dura)

  let offset = 0;
  const arcs = slices
    .filter((s) => s.count > 0)
    .map((s) => {
      const frac = s.count / Math.max(total, 1);
      const len = Math.max(frac * c - gap, 0);
      const arc = { status: s.status, len, offset, color: statusColors(s.status).fg };
      offset += frac * c;
      return arc;
    });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-5, 20px)", flexWrap: "wrap" }}>
      <span style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "inline-grid", placeItems: "center" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--viz-ring-track, var(--track))" strokeWidth={stroke} />
          {arcs.map((a) => (
            <circle key={a.status} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a.color} strokeWidth={stroke}
              strokeDasharray={`${a.len} ${c - a.len}`} strokeDashoffset={-a.offset} />
          ))}
        </svg>
        <span style={{ position: "relative", display: "grid", placeItems: "center", lineHeight: 1 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 600, color: "var(--text)", letterSpacing: "-1px" }}>{total}</span>
        </span>
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 130 }}>
        {slices.filter((s) => s.count > 0).map((s) => (
          <div key={s.status} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: statusColors(s.status).fg, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, color: "var(--text)" }}>{labelOf(s.status)}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
