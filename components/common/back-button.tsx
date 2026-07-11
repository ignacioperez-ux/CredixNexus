"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";

/** Volver a la pantalla/accion que invoco esta. Usa el historial (router.back);
 *  si se abrio directo y hay un fallback, navega alli. */
export function BackButton({ fallback }: { fallback?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  function go() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else if (fallback) router.push(fallback);
    else router.back();
  }
  return (
    <button onClick={go}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--accent-2)", background: "transparent", border: "none", cursor: "pointer", padding: 0, marginBottom: 4 }}>
      ← {t("common.back")}
    </button>
  );
}
