import { ErrorCode, minLength, firstError } from "@/lib/validation";

// Dominio de calidad de proyecto (F4). Logica pura para UI, acciones y pruebas.

export const QA_STATUSES = ["pending", "in_testing", "passed", "failed"] as const;
export const TEST_TYPES = ["functional", "regression", "integration", "uat", "security", "performance", "smoke"] as const;
export const ENVIRONMENTS = ["test", "staging", "preprod"] as const;
export const RESULTS = ["pass", "fail", "blocked"] as const;

/** Transiciones validas del estado de calidad. */
export const QA_NEXT: Record<string, string[]> = {
  pending: ["in_testing"],
  in_testing: ["passed", "failed"],
  failed: ["in_testing"],
  passed: ["in_testing"], // reprueba/re-testea si aparece algo
};

export function canQaTransition(from: string, to: string): boolean {
  return (QA_NEXT[from] ?? []).includes(to);
}

/** El pase a produccion solo puede autorizarse con la calidad APROBADA. */
export function canAuthorizeProduction(qaStatus: string): boolean {
  return qaStatus === "passed";
}

export type ValidationRunInput = { name: string; testType: string; environment: string; result: string };

export function validateValidationRun(i: ValidationRunInput): string | null {
  return firstError(
    minLength(i.name, 3),
    (TEST_TYPES as readonly string[]).includes(i.testType) ? null : ErrorCode.FORMAT,
    (ENVIRONMENTS as readonly string[]).includes(i.environment) ? null : ErrorCode.FORMAT,
    (RESULTS as readonly string[]).includes(i.result) ? null : ErrorCode.FORMAT,
  );
}
