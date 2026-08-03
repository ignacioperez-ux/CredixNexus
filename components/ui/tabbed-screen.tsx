"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Shell de pantalla con pestanas, deep-link por ?tab= (consistente con la Torre y el portal).
// Solo monta el contenido de la pestana activa (las demas no se montan). Tokens del DS (§7).
// Usado por las fusiones de Operaciones (Fase B): Agentes+Carga, Catalogo+SLA.

export type ScreenTab = { key: string; label: string; content: ReactNode };

export function TabbedScreen({ tabs }: { tabs: ScreenTab[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const param = sp.get("tab");
  const active = tabs.find((t) => t.key === param)?.key ?? tabs[0].key;

  function setTab(k: string) {
    const p = new URLSearchParams(Array.from(sp.entries()));
    if (k === tabs[0].key) p.delete("tab");
    else p.set("tab", k);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div role="tablist" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", overflowX: "auto" }}>
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}
              style={{
                appearance: "none", background: "transparent", border: "none", cursor: "pointer",
                padding: "10px 16px", marginBottom: -1, fontSize: 13.5, fontWeight: on ? 700 : 600,
                fontFamily: "var(--font-ui)", color: on ? "var(--text)" : "var(--muted)",
                borderBottom: `2px solid ${on ? "var(--accent)" : "transparent"}`, whiteSpace: "nowrap",
              }}>
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.find((t) => t.key === active)?.content}
    </div>
  );
}
