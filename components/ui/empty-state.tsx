import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

/* ============================================================================
 * EmptyState — estado vacio ilustrado del DS Credix (reemplaza el "Sin X" pelado).
 * Reutiliza el patron .cx-empty de globals.css para consistencia app-wide.
 * ========================================================================== */

export function EmptyState({
  icon = "inbox",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="cx-empty">
      <Icon name={icon} size={32} color="var(--muted)" />
      <div className="t">{title}</div>
      {hint && <div className="h">{hint}</div>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
