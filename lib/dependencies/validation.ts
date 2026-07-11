// Validacion pura de dependencias de servicio (espejo de constraints de 0058 + reglas
// de negocio: no auto-dependencia, tipo valido). El chequeo de ciclo usa wouldCreateCycle
// (lib/dependencies/graph) contra las aristas existentes en la capa de accion.

import { ErrorCode, firstError, required } from "@/lib/validation";

export const DEPENDENCY_TYPES = ["sync", "async", "data", "infra", "manual"] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export type DependencyInput = { serviceId: string; dependsOnId: string; dependencyType: string; criticality: string; description?: string };

const LEVELS = ["critical", "high", "medium", "low"];

export function validateDependencyInput(i: DependencyInput): string | null {
  return firstError(
    required(i.serviceId),
    required(i.dependsOnId),
    i.serviceId === i.dependsOnId ? ErrorCode.STATE : null,
    (DEPENDENCY_TYPES as readonly string[]).includes(i.dependencyType) ? null : ErrorCode.FORMAT,
    LEVELS.includes(i.criticality) ? null : ErrorCode.FORMAT,
  );
}
