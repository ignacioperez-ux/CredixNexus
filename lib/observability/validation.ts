// Observability Center — validacion pura (espejo de los CHECK de sql/0056).
// Sin dependencias de red: testeable en Vitest. CLAUDE.md §10.7.

import { ErrorCode, firstError, required } from "@/lib/validation";
import type { Impact, Urgency } from "@/lib/incidents/priority";

export const ALERT_SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export const ALERT_STATUSES = ["open", "acknowledged", "correlated", "resolved"] as const;
export const DX_CHANNELS = ["web", "mobile", "api", "ivr", "whatsapp"] as const;
export const DX_STATUSES = ["success", "error", "slow"] as const;

export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];
export type AlertStatus = (typeof ALERT_STATUSES)[number];

/** Mapa severidad de alerta -> (impacto, urgencia) ITIL. La prioridad final se deriva
 *  con derivePriority (misma matriz que public.derive_priority). Datos, no negocio quemado:
 *  refleja la escala de severidad del esquema. */
const SEVERITY_MAP: Record<AlertSeverity, { impact: Impact; urgency: Urgency }> = {
  critical: { impact: "critical", urgency: "critical" },
  high: { impact: "high", urgency: "high" },
  medium: { impact: "medium", urgency: "medium" },
  low: { impact: "low", urgency: "low" },
  info: { impact: "low", urgency: "low" },
};

export function severityToImpactUrgency(severity: string): { impact: Impact; urgency: Urgency } {
  return SEVERITY_MAP[(severity as AlertSeverity)] ?? SEVERITY_MAP.medium;
}

/** Solo se puede reconocer una alerta abierta. */
export function validateAcknowledge(status: string): string | null {
  if (status !== "open") return ErrorCode.STATE;
  return null;
}

/** Se puede resolver una alerta que no este ya resuelta. */
export function validateResolve(status: string): string | null {
  if (status === "resolved") return ErrorCode.STATE;
  return null;
}

/** Correlacionar con un caso existente: requiere id de caso y que la alerta no este resuelta. */
export function validateCorrelate(status: string, caseId: string): string | null {
  return firstError(
    required(caseId),
    status === "resolved" ? ErrorCode.STATE : null,
  );
}

/** Crear caso desde alerta: la alerta no debe estar ya correlacionada ni resuelta. */
export function validateCreateCase(status: string): string | null {
  if (status === "correlated" || status === "resolved") return ErrorCode.STATE;
  return null;
}
