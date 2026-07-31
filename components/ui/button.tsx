"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

/* ============================================================================
 * Button — componente base del Design System Credix.
 * Consume tokens (var(--token)) => funciona en ambos temas (Nexus/Claro).
 * Variantes segun el grupo "Buttons" del DS: primary / tonal / outlined / text /
 * destructive / dark. Alturas DS: sm 32, md 40, lg 56. Radio DS boton = 12 (Claro).
 * NO cambia logica de negocio: es solo presentacion (onClick, type, disabled del DOM).
 * ========================================================================== */

export type ButtonVariant = "primary" | "tonal" | "outlined" | "text" | "destructive" | "dark";
export type ButtonSize = "sm" | "md" | "lg";

const HEIGHT: Record<ButtonSize, number> = { sm: 32, md: 40, lg: 56 };
const PAD: Record<ButtonSize, string> = { sm: "0 16px", md: "0 24px", lg: "0 28px" };
const FONT: Record<ButtonSize, number> = { sm: 13, md: 14, lg: 15 };

function variantStyle(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case "primary":
      return { background: "var(--cta-grad, var(--primary, var(--accent)))", color: "var(--on-primary, #fff)", border: "none", boxShadow: "var(--sh-red, none)" };
    case "tonal":
      return { background: "var(--credix-color-secondary-container, var(--paper))", color: "var(--credix-color-on-surface, var(--text))", border: "none" };
    case "outlined":
      return { background: "transparent", color: "var(--primary, var(--accent))", border: "1.5px solid var(--primary, var(--accent))" };
    case "text":
      return { background: "transparent", color: "var(--primary, var(--accent))", border: "none" };
    case "destructive":
      return { background: "var(--credix-color-error, #FF4965)", color: "#fff", border: "none" };
    case "dark":
      return { background: "var(--dark-surface, #141318)", color: "#fff", border: "none" };
  }
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  block?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  block = false,
  children,
  style,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={"cx-ds-btn " + (rest.className ?? "")}
      style={{
        display: block ? "flex" : "inline-flex",
        width: block ? "100%" : undefined,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: HEIGHT[size],
        padding: PAD[size],
        borderRadius: "var(--r-md, 12px)",
        fontFamily: "var(--font-ui)",
        fontWeight: 700,
        fontSize: FONT[size],
        lineHeight: 1,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
        transition: "background var(--t-fast), border-color var(--t-fast), transform .15s ease, box-shadow .15s ease",
        ...variantStyle(variant),
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} color="currentColor" />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 16 : 18} color="currentColor" />}
    </button>
  );
}

/* IconButton — accion compacta solo-icono. Requiere aria-label (a11y). */
export function IconButton({
  icon,
  size = 40,
  variant = "text",
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; size?: number; variant?: ButtonVariant }) {
  return (
    <button
      {...rest}
      className={"cx-ds-btn " + (rest.className ?? "")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "var(--r-md, 12px)",
        cursor: rest.disabled ? "default" : "pointer",
        opacity: rest.disabled ? 0.5 : 1,
        transition: "background var(--t-fast)",
        ...variantStyle(variant),
        padding: 0,
        ...style,
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color="currentColor" />
    </button>
  );
}
