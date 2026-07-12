// Esqueleto de carga a nivel de ruta (App Router). Se muestra al INSTANTE al navegar,
// mientras el server component trae los datos: elimina el "rendering" en blanco.
// La barra lateral y el header (en el layout) quedan fijos; solo cambia el contenido.

const shimmer = "cx-shimmer";

export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        .${shimmer} { position: relative; overflow: hidden; background: var(--paper); border-radius: var(--r-md); }
        .${shimmer}::after {
          content: ""; position: absolute; inset: 0; transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(128,128,128,.10), transparent);
          animation: cxsh 1.15s infinite;
        }
        @keyframes cxsh { 100% { transform: translateX(100%); } }
        @media (prefers-reduced-motion: reduce) { .${shimmer}::after { animation: none; } }
      `}</style>

      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className={shimmer} style={{ width: 220, height: 24 }} />
        <div className={shimmer} style={{ width: 90, height: 20, borderRadius: "var(--r-pill)" }} />
      </div>

      {/* Tarjetas KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div className={shimmer} style={{ width: "60%", height: 12 }} />
            <div className={shimmer} style={{ width: 48, height: 26 }} />
          </div>
        ))}
      </div>

      {/* Bloque de tabla */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className={shimmer} style={{ width: 180, height: 16 }} />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className={shimmer} style={{ width: 90, height: 14 }} />
            <div className={shimmer} style={{ flex: 1, height: 14 }} />
            <div className={shimmer} style={{ width: 110, height: 14 }} />
            <div className={shimmer} style={{ width: 70, height: 14 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
