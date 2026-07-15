"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { useNavHistory } from "./nav-history-provider";

// "Volver" UNIVERSAL: se renderiza una sola vez en el layout, arriba del contenido de cada
// pantalla. Aparece cuando llegaste desde otra pantalla in-app (hay historial) y regresa a la
// pantalla que invoco la actual. En la pantalla de entrada (sin historial) no aparece, y ahi el
// BackButton de la pantalla toma el relevo con su padre canonico. Asi SIEMPRE hay "Volver".
export function PageBack() {
  const { canGoBack } = useNavHistory();
  const router = useRouter();
  const { t } = useI18n();
  if (!canGoBack) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => router.back()}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--accent-2)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
        <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>&larr;</span> {t("common.back")}
      </button>
    </div>
  );
}
