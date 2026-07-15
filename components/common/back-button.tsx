"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useGoBack } from "@/lib/nav/use-go-back";

/** Estandar de "Volver" en todo el app. Regresa a la pantalla in-app que invoco la actual
 *  (router.back sobre el historial real). Si la pantalla se abrio directo (deep-link o recarga,
 *  sin historial in-app) navega al padre canonico `fallback`. Asi la salida es SIEMPRE ordenada
 *  y nunca abandona el app. `label` permite nombrar el destino (p.ej. "Volver a Proyectos"). */
export function BackButton({ fallback, label }: { fallback: string; label?: MessageKey }) {
  const { t } = useI18n();
  const go = useGoBack(fallback);
  return (
    <button onClick={go}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--accent-2)", background: "transparent", border: "none", cursor: "pointer", padding: 0, marginBottom: 4 }}>
      <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>&larr;</span> {label ? t(label) : t("common.back")}
    </button>
  );
}
