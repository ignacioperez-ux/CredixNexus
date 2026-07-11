// Fraude y Disputas — validacion pura (espejo de los CHECK de 0059) + maquinas de estado.
// Testeable sin red. CLAUDE.md §10.7.

import { ErrorCode, firstError } from "@/lib/validation";

export const FRAUD_TYPES = ["account_takeover", "card_not_present", "identity_theft", "phishing", "friendly_fraud", "merchant_fraud", "other"] as const;
export const FRAUD_STATUSES = ["reported", "investigating", "confirmed", "false_positive", "recovered", "closed"] as const;
export const DETECTION_SOURCES = ["customer_report", "monitoring_alert", "manual_review", "rule_engine"] as const;

export const DISPUTE_TYPES = ["unrecognized_charge", "duplicate_charge", "payment_not_applied", "incorrect_amount", "service_not_received", "refund_pending", "other"] as const;
export const DISPUTE_STATUSES = ["opened", "investigating", "awaiting_customer", "submitted", "won", "lost", "cancelled", "closed"] as const;

// Maquinas de estado (transiciones permitidas). Un estado no listado es terminal.
const FRAUD_TRANSITIONS: Record<string, string[]> = {
  reported: ["investigating", "false_positive"],
  investigating: ["confirmed", "false_positive"],
  confirmed: ["recovered", "closed"],
  recovered: ["closed"],
  false_positive: ["closed"],
  closed: [],
};

const DISPUTE_TRANSITIONS: Record<string, string[]> = {
  opened: ["investigating", "cancelled"],
  investigating: ["awaiting_customer", "submitted", "cancelled"],
  awaiting_customer: ["submitted", "cancelled"],
  submitted: ["won", "lost"],
  won: ["closed"],
  lost: ["closed"],
  cancelled: [],
  closed: [],
};

export function fraudNextStates(status: string): string[] {
  return FRAUD_TRANSITIONS[status] ?? [];
}
export function disputeNextStates(status: string): string[] {
  return DISPUTE_TRANSITIONS[status] ?? [];
}

/** Transicion valida de fraude: destino alcanzable desde el estado actual. */
export function validateFraudTransition(from: string, to: string): string | null {
  return fraudNextStates(from).includes(to) ? null : ErrorCode.STATE;
}
export function validateDisputeTransition(from: string, to: string): string | null {
  return disputeNextStates(from).includes(to) ? null : ErrorCode.STATE;
}

export type FraudOpenInput = { fraudType: string; detectionSource: string; riskScore?: number | null; amountExposed?: number | null; currency?: string };
export type DisputeOpenInput = { disputeType: string; disputedAmount?: number | null; currency?: string; reasonCode?: string; dueDate?: string | null };

export function validateFraudOpen(i: FraudOpenInput): string | null {
  return firstError(
    (FRAUD_TYPES as readonly string[]).includes(i.fraudType) ? null : ErrorCode.FORMAT,
    (DETECTION_SOURCES as readonly string[]).includes(i.detectionSource) ? null : ErrorCode.FORMAT,
    i.riskScore != null && (i.riskScore < 0 || i.riskScore > 100) ? ErrorCode.FORMAT : null,
    i.amountExposed != null && i.amountExposed < 0 ? ErrorCode.FORMAT : null,
  );
}

export function validateDisputeOpen(i: DisputeOpenInput): string | null {
  return firstError(
    (DISPUTE_TYPES as readonly string[]).includes(i.disputeType) ? null : ErrorCode.FORMAT,
    i.disputedAmount != null && i.disputedAmount < 0 ? ErrorCode.FORMAT : null,
  );
}

/** Monto recuperado no puede exceder el expuesto/disputado (cuando ambos existen). */
export function validateRecovery(recovered: number, ceiling: number | null | undefined): string | null {
  if (recovered < 0) return ErrorCode.FORMAT;
  if (ceiling != null && recovered > ceiling) return ErrorCode.FORMAT;
  return null;
}

/** Enmascara nombre de cliente (PII, §3.1 #12): deja iniciales visibles. */
export function maskName(v: string | null | undefined): string {
  if (!v) return "—";
  return v
    .trim()
    .split(/\s+/)
    .map((part) => (part.length <= 1 ? part : part[0] + "•".repeat(Math.min(part.length - 1, 5))))
    .join(" ");
}
