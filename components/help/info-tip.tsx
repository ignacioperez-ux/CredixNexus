"use client";

import { useState, useRef, useEffect } from "react";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";

// Ayuda contextual liviana: badge "i" que muestra un texto guia (una clave i18n) en un popover.
// Hover (desktop) + click (touch), con cierre por clic afuera. Para microcopy por modulo (C1).
export function InfoTip({ tip, size = 14 }: { tip: MessageKey; size?: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const text = t(tip);
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={text} onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        style={{ width: size, height: size, borderRadius: "50%", border: "1px solid var(--muted)", background: "transparent", color: "var(--muted)", fontSize: size * 0.66, fontWeight: 800, lineHeight: 1, cursor: "help", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "var(--font-ui)", flexShrink: 0 }}
      >i</button>
      {open && (
        <span role="tooltip" style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", zIndex: 40, width: 272, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", boxShadow: "0 18px 44px -18px rgba(0,0,0,.45)", padding: "11px 13px", textAlign: "left", cursor: "default", whiteSpace: "normal", fontSize: 12, color: "var(--text)", lineHeight: 1.5, fontWeight: 400 }}>{text}</span>
      )}
    </span>
  );
}
