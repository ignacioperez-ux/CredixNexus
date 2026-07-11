import { ErrorCode, minLength, firstError } from "@/lib/validation";

// Validacion pura de configuracion SLA (reglas + OLA). Espeja los CHECK de BD (§10.7).

export const SLA_TYPES = ["response", "resolution"] as const;
export const ESC_ACTIONS = ["notify", "raise_priority", "reassign_team"] as const;
export const PRIORITIES = ["p1_critical", "p2_high", "p3_medium", "p4_low"] as const;

export type EscalationRuleInput = {
  code: string;
  name: string;
  slaType: string;
  thresholdPct: number;
  priority?: string | null;
  action: string;
  notifyRole?: string | null;
  actionTarget?: string | null;
};

export function validateEscalationRule(i: EscalationRuleInput): string | null {
  const base = firstError(
    minLength(i.code, 2),
    minLength(i.name, 3),
    (SLA_TYPES as readonly string[]).includes(i.slaType) ? null : ErrorCode.FORMAT,
    (ESC_ACTIONS as readonly string[]).includes(i.action) ? null : ErrorCode.FORMAT,
    Number.isInteger(i.thresholdPct) && i.thresholdPct >= 1 && i.thresholdPct <= 100 ? null : ErrorCode.FORMAT,
    i.priority && !(PRIORITIES as readonly string[]).includes(i.priority) ? ErrorCode.FORMAT : null,
  );
  if (base) return base;
  // Coherencia accion <-> destino (espeja los CHECK de BD)
  if (i.action === "notify" && !clean(i.notifyRole)) return ErrorCode.REQUIRED;
  if (i.action === "reassign_team" && !clean(i.actionTarget)) return ErrorCode.REQUIRED;
  return null;
}

export type OlaInput = {
  priority: string;
  responseMinutes: number;
  resolutionMinutes: number;
  assignedTeam?: string | null;
};

export function validateOla(i: OlaInput): string | null {
  return firstError(
    (PRIORITIES as readonly string[]).includes(i.priority) ? null : ErrorCode.FORMAT,
    Number.isInteger(i.responseMinutes) && i.responseMinutes > 0 ? null : ErrorCode.FORMAT,
    Number.isInteger(i.resolutionMinutes) && i.resolutionMinutes > 0 ? null : ErrorCode.FORMAT,
    // resolucion no puede ser mas estricta que la respuesta
    i.resolutionMinutes < i.responseMinutes ? ErrorCode.FORMAT : null,
  );
}

const clean = (v?: string | null) => !!v && v.trim().length > 0;
