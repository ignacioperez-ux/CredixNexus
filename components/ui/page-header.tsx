import type { ReactNode } from "react";

/* ============================================================================
 * PageHeader — titulo de pantalla + subtitulo + acciones (DS Credix).
 * Tipografia: titulo en Heebo (var(--font-display)); escala Baseline "Headline".
 * ========================================================================== */

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
}) {
  return (
    <header style={{ marginBottom: 20 }}>
      {breadcrumbs && <div style={{ marginBottom: 8 }}>{breadcrumbs}</div>}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            className="cx-title"
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "var(--fs-page-title, 25px)",
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              color: "var(--text)",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, maxWidth: "72ch" }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>{actions}</div>}
      </div>
    </header>
  );
}
