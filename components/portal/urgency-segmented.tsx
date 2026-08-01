"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { Urgency } from "@/lib/incidents/priority";

// Grupo segmentado de urgencia (P1.3): 4 botones en linea "Bajo · Medio · Alto · Critico",
// un clic en lugar de abrir un <select>. Seleccionado en rojo Credix con texto blanco peso 700;
// los demas en superficie baja con borde. 50px de alto (objetivo tactil >=44px, R6). Tokens del DS
// (tema claro/oscuro). Accesible: role=radiogroup + aria-checked + label textual (R7).

// Orden ascendente de menor a mayor (el enum de BD va al reves; aqui ordenamos para el usuario).
const ORDER: Urgency[] = ["low", "medium", "high", "critical"];

export function UrgencySegmented({ value, onChange, ariaLabel }: { value: Urgency; onChange: (u: Urgency) => void; ariaLabel?: string }) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-label={ariaLabel ?? t("portal.create.field.urgency")} style={{ display: "flex", gap: 8, width: "100%" }}>
      {ORDER.map((u) => {
        const active = value === u;
        return (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(u)}
            style={{
              flex: 1,
              minWidth: 0,
              height: 50,
              borderRadius: "var(--r-md, 12px)",
              cursor: "pointer",
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              fontWeight: active ? 700 : 600,
              transition: "background var(--t-fast), border-color var(--t-fast), color var(--t-fast)",
              background: active ? "var(--accent)" : "var(--paper)",
              border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
              color: active ? "var(--on-accent, #fff)" : "var(--muted)",
            }}
          >
            {t(("lvl." + u) as MessageKey)}
          </button>
        );
      })}
    </div>
  );
}
