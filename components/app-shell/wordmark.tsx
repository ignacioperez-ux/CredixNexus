"use client";

import { useState } from "react";

/** Marca: logo Credix (archivo oficial en /public, fallback a tile rojo) + nombre
 *  del producto "CredixNexus" (Credix en blanco, Nexus en rojo). */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  const [imgOk, setImgOk] = useState(true);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {imgOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/credix-logo.png"
          alt="Credix"
          onError={() => setImgOk(false)}
          style={{ height: 30, width: "auto", display: "block", objectFit: "contain", flexShrink: 0 }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg, #FF2247, #B00021)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 3px 14px rgba(228,0,43,.45)", flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, color: "#fff", lineHeight: 1 }}>C</span>
        </div>
      )}
      {!compact && (
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, letterSpacing: "-0.4px", color: "var(--text)" }}>
          Credix<span style={{ color: "var(--accent-2)" }}>Nexus</span>
        </span>
      )}
    </div>
  );
}
