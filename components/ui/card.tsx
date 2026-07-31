import type { CSSProperties, ReactNode } from "react";

/* ============================================================================
 * Card — superficie base del DS Credix (outlined / elevated).
 * Tokens: --card (surface lowest), --line (outline variant), --r-card/--r-lg.
 * Funciona en ambos temas. En Claro recibe elevacion via la regla global de globals.css.
 * ========================================================================== */

export function Card({
  variant = "outlined",
  padding = 20,
  children,
  style,
  ...rest
}: {
  variant?: "outlined" | "elevated";
  padding?: number | string;
  children: ReactNode;
  style?: CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      style={{
        background: variant === "elevated" ? "var(--paper, var(--card))" : "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-card, var(--r-lg, 16px))",
        padding,
        boxShadow: variant === "elevated" ? "var(--sh-card)" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* SectionHeader — encabezado de bloque dentro de una tarjeta/pagina. */
export function SectionHeader({
  title,
  hint,
  action,
  icon,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      {icon}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</div>
        {hint && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{hint}</div>}
      </div>
      {action}
    </div>
  );
}
