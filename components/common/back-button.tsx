"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useNavHistory } from "@/components/app-shell/nav-history-provider";

/** "Volver" a nivel de pantalla. Complementa al "Volver" universal (PageBack): cuando HAY
 *  historial in-app, el universal ya muestra el retorno y este no se dibuja (evita duplicado);
 *  cuando NO hay historial (deep-link o recarga directa), este toma el relevo y navega al padre
 *  canonico `fallback`. Asi la pantalla siempre ofrece una salida ordenada. `label` nombra el
 *  destino (p.ej. "Volver a Proyectos"). */
export function BackButton({ fallback, label }: { fallback: string; label?: MessageKey }) {
  const { t } = useI18n();
  const { canGoBack, back } = useNavHistory();
  if (canGoBack) return null;
  return (
    <button onClick={() => back(fallback)}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--accent-2)", background: "transparent", border: "none", cursor: "pointer", padding: 0, marginBottom: 4 }}>
      <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>&larr;</span> {label ? t(label) : t("common.back")}
    </button>
  );
}
