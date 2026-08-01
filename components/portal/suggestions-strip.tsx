"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/icon";

// Tira de sugerencias compacta y DESCARTABLE (P2). Reemplaza el panel lateral fijo que consumia
// media pantalla mientras el usuario escribia. Aparece DEBAJO del campo de texto al llegar a 8
// caracteres. Colapsada: una fila (~54px). Expandida: un resultado por fila con etiqueta de origen
// y accion. La X la cierra de forma PERSISTENTE durante esa sesion de redaccion (el padre no la
// vuelve a montar). Nunca ocupa >~40% del alto ni empuja el boton de envio fuera de pantalla.
// Tokens del DS (tema claro/oscuro), R6/R7.

export type StripItem = {
  key: string;
  origin: "kb" | "open" | "previous";
  title: string;
  number?: string;
  href: string;
  actionKey: "portal.strip.action.solution" | "portal.strip.action.open";
  disabled?: boolean;
};

const ORIGIN: Record<StripItem["origin"], { labelKey: string; fg: string; bg: string }> = {
  kb: { labelKey: "portal.strip.origin.kb", fg: "var(--st-low-fg, var(--st-low))", bg: "var(--st-low-bg)" },
  open: { labelKey: "portal.strip.origin.open", fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  previous: { labelKey: "portal.strip.origin.previous", fg: "var(--muted)", bg: "var(--paper)" },
};

export function SuggestionsStrip({ items, onDismiss }: { items: StripItem[]; onDismiss: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div style={{ borderRadius: "var(--r-md, 13px)", overflow: "hidden", border: "1px solid var(--st-info-bg)", maxHeight: "40vh", display: "flex", flexDirection: "column" }}>
      {/* Fila colapsada (~54px) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 54, padding: "8px 12px", background: "var(--st-info-bg)" }}>
        <span aria-hidden style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--st-info)", color: "#fff" }}>
          <Icon name="sparkle" size={15} color="#fff" />
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: "var(--st-info)" }}>
          {t("portal.strip.summary").replace("{n}", String(items.length))}
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="cx-ds-btn"
          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--st-info)", padding: "8px 10px", minHeight: 44 }}>
          {open ? t("portal.strip.hide") : t("portal.strip.show")}
        </button>
        <button type="button" onClick={onDismiss} aria-label={t("portal.strip.dismiss")} className="cx-ds-btn"
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--st-info)", display: "inline-flex", padding: 10, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}>
          <Icon name="x" size={16} aria-hidden />
        </button>
      </div>

      {/* Expandida: un resultado por fila */}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, background: "var(--card)", overflowY: "auto" }}>
          {items.map((it) => {
            const o = ORIGIN[it.origin];
            const row = (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-md, 10px)", minHeight: 48 }}>
                <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: o.fg, background: o.bg, padding: "3px 8px", borderRadius: "var(--r-pill, 999px)" }}>
                  {t(o.labelKey as never)}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: it.disabled ? "var(--muted)" : "var(--accent-2)" }}>
                  {t(it.actionKey)} →
                </span>
              </div>
            );
            return it.disabled
              ? <div key={it.key} style={{ opacity: 0.7 }}>{row}</div>
              : <Link key={it.key} href={it.href} className="cx-lift" style={{ textDecoration: "none" }}>{row}</Link>;
          })}
        </div>
      )}
    </div>
  );
}
