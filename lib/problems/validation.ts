import { ErrorCode, minLength, firstError } from "@/lib/validation";

// Validacion pura del dominio Problem (ITIL). Se usa en el server action y en pruebas.
// Espeja los CHECK de BD (§10.7 validacion en capas).

export const PROBLEM_STATUSES = ["new", "investigating", "known_error", "resolved", "closed"] as const;
export const PROBLEM_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export type ProblemStatus = (typeof PROBLEM_STATUSES)[number];
export type ProblemPriority = (typeof PROBLEM_PRIORITIES)[number];

/** Transiciones de estado validas (previene saltos ilogicos). */
export const PROBLEM_NEXT: Record<string, ProblemStatus[]> = {
  new: ["investigating"],
  investigating: ["known_error", "resolved"],
  known_error: ["resolved"],
  resolved: ["closed", "investigating"],
  closed: [],
};

export type ProblemValidatable = {
  title: string;
  priority: string;
  knownError?: boolean;
  rootCauseSummary?: string;
};

/** Devuelve un ErrorCode o null. Un error conocido exige causa raiz (CHECK de BD). */
export function validateProblem(i: ProblemValidatable): string | null {
  const rcaMissing = !i.rootCauseSummary || i.rootCauseSummary.trim().length === 0;
  return firstError(
    minLength(i.title, 5),
    (PROBLEM_PRIORITIES as readonly string[]).includes(i.priority) ? null : ErrorCode.FORMAT,
    i.knownError && rcaMissing ? ErrorCode.REQUIRED : null,
  );
}

export function canTransition(from: string, to: string): boolean {
  return (PROBLEM_NEXT[from] ?? []).includes(to as ProblemStatus);
}
