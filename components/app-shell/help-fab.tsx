"use client";

import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";

// FAB de ayuda (estilo credix.com): circulo rojo fijo abajo a la derecha. Abre el Command
// Menu (Ctrl/Cmd+K) como via rapida de "buscar / que necesitas". Usa tokens de marca.
export function HelpFab() {
  const { t } = useI18n();
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("cx:open-command"))}
      title={t("fab.help")}
      aria-label={t("fab.help")}
      style={{
        position: "fixed", right: 24, bottom: 24, zIndex: 80,
        width: 52, height: 52, borderRadius: "50%",
        background: "var(--cta-bg)", color: "var(--cta-fg)", border: "none",
        cursor: "pointer", display: "grid", placeItems: "center",
        boxShadow: "var(--sh-fab)",
      }}
    >
      <Icon name="help" size={24} color="var(--cta-icon)" />
    </button>
  );
}
