import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

/* ============================================================================
 * Badge / StatusBadge — DS Credix.
 * REGLA a11y (DESIGN §): el estado NUNCA se comunica solo por color -> Badge
 * incluye siempre texto y, opcionalmente, un icono/punto. Colores por token de
 * estado (--st-*) que resuelven por tema (Nexus/Claro) desde globals.css.
 * ========================================================================== */

export type BadgeTone = "neutral" | "success" | "warning" | "info" | "error" | "brand";

const TONE: Record<BadgeTone, { fg: string; bg: string }> = {
  neutral: { fg: "var(--muted)", bg: "var(--paper)" },
  success: { fg: "var(--st-low-fg, var(--st-low))", bg: "var(--st-low-bg)" },
  warning: { fg: "var(--st-high-fg, var(--st-high))", bg: "var(--st-high-bg)" },
  info: { fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  error: { fg: "var(--st-critical-fg, var(--st-critical))", bg: "var(--st-critical-bg)" },
  brand: { fg: "var(--on-accent, #fff)", bg: "var(--accent)" },
};

export function Badge({
  tone = "neutral",
  icon,
  dot = false,
  children,
}: {
  tone?: BadgeTone;
  icon?: string;
  dot?: boolean;
  children: ReactNode;
}) {
  const c = TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 9px",
        borderRadius: "var(--r-pill, 999px)",
        fontSize: 11.5,
        fontWeight: 700,
        lineHeight: 1.5,
        color: c.fg,
        background: c.bg,
        whiteSpace: "nowrap",
      }}
    >
      {dot && <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />}
      {icon && <Icon name={icon} size={12} color="currentColor" />}
      {children}
    </span>
  );
}

/* StatusBadge — envoltura semantica: recibe un tone ya resuelto + etiqueta. */
export function StatusBadge({ tone, label, icon }: { tone: BadgeTone; label: string; icon?: string }) {
  return (
    <Badge tone={tone} icon={icon} dot={!icon}>
      {label}
    </Badge>
  );
}
