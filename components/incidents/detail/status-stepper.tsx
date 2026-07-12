"use client";

import { useI18n } from "@/lib/i18n/provider";
import { statusKey } from "@/lib/incidents/labels";
import { Icon } from "@/components/ui/icon";

// Ciclo de vida principal del caso, como pasos. El estado actual se marca claramente;
// los previos quedan "hechos" (check). Reemplaza la fila de botones con flechas que se
// leia como un flujo confuso (y donde "Eliminar" parecia un paso). Ver status-actions.
const MAIN = ["new", "triaged", "assigned", "in_progress", "resolved"] as const;

// Estados que no estan en la ruta principal se mapean a su paso equivalente.
const STEP_OF: Record<string, number> = {
  new: 0, triaged: 1, assigned: 2, in_progress: 3, waiting: 3, reopened: 3, resolved: 4, closed: 4,
};

export function StatusStepper({ status }: { status: string }) {
  const { t } = useI18n();

  // Ramas / estados terminales fuera de la ruta feliz: se muestran como chip aparte.
  if (status === "in_evolution" || status === "cancelled") {
    const branch = status === "in_evolution";
    return (
      <div role="group" aria-label={t("inc.stepper.aria")} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Chip label={t(statusKey("triaged"))} tone="done" />
        <Icon name="chevron-right" size={13} color="var(--line)" />
        <Chip label={t(statusKey(status))} tone={branch ? "active" : "muted"} />
      </div>
    );
  }

  const current = STEP_OF[status] ?? 0;
  return (
    <div role="group" aria-label={t("inc.stepper.aria")} style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {MAIN.map((s, i) => {
        const done = i < current;
        const active = i === current;
        // En el paso activo mostramos la etiqueta exacta del estado (p.ej. "En espera", "Reabierto").
        const label = active && s !== status ? t(statusKey(status)) : t(statusKey(s));
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Chip label={label} tone={active ? "active" : done ? "done" : "todo"} check={done} />
            {i < MAIN.length - 1 && <Icon name="chevron-right" size={13} color="var(--line)" />}
          </div>
        );
      })}
    </div>
  );
}

function Chip({ label, tone, check }: { label: string; tone: "active" | "done" | "todo" | "muted"; check?: boolean }) {
  const styles: Record<string, { fg: string; bg: string }> = {
    active: { fg: "var(--cta-fg)", bg: "var(--cta-bg)" },
    done: { fg: "var(--st-low-fg)", bg: "var(--st-low-bg)" },
    todo: { fg: "var(--muted)", bg: "var(--paper)" },
    muted: { fg: "var(--muted)", bg: "var(--paper)" },
  };
  const c = styles[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: tone === "active" ? 700 : 600, padding: "5px 11px", borderRadius: "var(--r-pill)", color: c.fg, background: c.bg, whiteSpace: "nowrap" }}>
      {check && <Icon name="check" size={11} />}
      {label}
    </span>
  );
}
