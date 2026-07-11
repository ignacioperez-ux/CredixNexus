import { ErrorCode, minLength, firstError } from "@/lib/validation";

// Dominio de admision/triage. Logica pura para UI, acciones y pruebas.

export const CLASSIFICATIONS = ["incident", "improvement", "project"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

/** true si la clasificacion enruta a Evolucion (mejora/proyecto); incident = Operaciones. */
export function routesToEvolution(classification: string): boolean {
  return classification === "improvement" || classification === "project";
}

export function validateClassification(c: string): string | null {
  return (CLASSIFICATIONS as readonly string[]).includes(c) ? null : ErrorCode.FORMAT;
}

/** El descarte SIEMPRE exige motivo (siempre queda registrado el por que). */
export function validateDiscard(reason: string): string | null {
  return firstError(minLength(reason, 5));
}
