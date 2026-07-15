"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

// Ayuda contextual reutilizable: badge "i" que muestra termino + definicion + EJEMPLO Credix.
// Se activa por hover (desktop) y click (touch). Data-driven por i18n concept.<code>.*.
export function ConceptTip({ concept, size = 15 }: { concept: string; size?: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const term = t(`concept.${concept}.term` as MessageKey);
  const short = t(`concept.${concept}.short` as MessageKey);
  const example = t(`concept.${concept}.example` as MessageKey);

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={term}
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        style={{ width: size, height: size, borderRadius: "50%", border: "1px solid var(--muted)", background: "transparent", color: "var(--muted)", fontSize: size * 0.66, fontWeight: 800, lineHeight: 1, cursor: "help", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "var(--font-ui)" }}
      >i</button>
      {open && (
        <span role="tooltip" style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", zIndex: 40, width: 264, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", boxShadow: "0 18px 44px -18px rgba(0,0,0,.45)", padding: "12px 13px", textAlign: "left", cursor: "default", whiteSpace: "normal" }}>
          <span style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{term}</span>
          <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>{short}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--text)", marginTop: 8, padding: "7px 9px", background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: 8, lineHeight: 1.45 }}>{example}</span>
        </span>
      )}
    </span>
  );
}
