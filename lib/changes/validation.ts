import { ErrorCode, minLength, firstError } from "@/lib/validation";

// Dominio de Gestion de Cambios (ITIL). Logica pura para UI, acciones y pruebas.

export const CHANGE_TYPES = ["standard", "normal", "emergency"] as const;
export const RISK_LEVELS = ["low", "medium", "high"] as const;
export const CHANGE_STATUSES = [
  "draft", "assessment", "pending_cab", "approved", "scheduled",
  "implementing", "review", "closed", "rejected", "cancelled",
] as const;

export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

/** Maquina de estados del cambio. La decision CAB (approved/rejected) se aplica
 *  aparte con permiso change.approve; el resto son transiciones de gestion. */
export const CHANGE_NEXT: Record<string, ChangeStatus[]> = {
  draft: ["assessment", "cancelled"],
  assessment: ["pending_cab", "cancelled"],
  pending_cab: ["cancelled"], // approved/rejected solo via decision CAB
  approved: ["scheduled", "cancelled"],
  scheduled: ["implementing", "cancelled"],
  implementing: ["review", "cancelled"],
  review: ["closed"],
  rejected: ["closed"],
  closed: [],
  cancelled: [],
};

export function canTransition(from: string, to: string): boolean {
  return (CHANGE_NEXT[from] ?? []).includes(to as ChangeStatus);
}

/** La decision CAB (aprobar/rechazar) solo es valida cuando el cambio espera al CAB. */
export function canDecideCab(status: string): boolean {
  return status === "pending_cab";
}

export type ChangeValidatable = {
  title: string;
  changeType: string;
  riskLevel: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
};

export function validateChange(i: ChangeValidatable): string | null {
  const base = firstError(
    minLength(i.title, 5),
    (CHANGE_TYPES as readonly string[]).includes(i.changeType) ? null : ErrorCode.FORMAT,
    (RISK_LEVELS as readonly string[]).includes(i.riskLevel) ? null : ErrorCode.FORMAT,
  );
  if (base) return base;
  // Ventana planificada: fin no anterior a inicio (espeja el CHECK de BD, ambos sentidos)
  if (i.plannedStart && i.plannedEnd && new Date(i.plannedEnd).getTime() < new Date(i.plannedStart).getTime()) {
    return ErrorCode.FORMAT;
  }
  return null;
}
