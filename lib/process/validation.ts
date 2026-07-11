// Gobierno de datos — validacion pura de las matrices (testeable).

import { ErrorCode, firstError, required } from "@/lib/validation";

export const SYSTEM_ROLES = ["primary", "secondary", "integration", "manual"] as const;
export const AVAILABILITIES = ["active", "pilot", "retired"] as const;
const LEVELS = ["critical", "high", "medium", "low"];

export type ProcessSystemInput = { processId: string; ciId: string; role: string; criticality: string };
export type ProductChannelInput = { productId: string; channelId: string; availability: string };

export function validateProcessSystem(i: ProcessSystemInput): string | null {
  return firstError(
    required(i.processId),
    required(i.ciId),
    (SYSTEM_ROLES as readonly string[]).includes(i.role) ? null : ErrorCode.FORMAT,
    LEVELS.includes(i.criticality) ? null : ErrorCode.FORMAT,
  );
}

export function validateProductChannel(i: ProductChannelInput): string | null {
  return firstError(
    required(i.productId),
    required(i.channelId),
    (AVAILABILITIES as readonly string[]).includes(i.availability) ? null : ErrorCode.FORMAT,
  );
}

/** Densidad de una matriz (celdas cubiertas / total posible), 0-100. null si no hay universo. */
export function matrixDensity(covered: number, rows: number, cols: number): number | null {
  const total = rows * cols;
  if (total <= 0) return null;
  return Math.round((covered / total) * 100);
}

/** Salud de cobertura de un proceso: sin sistemas declarados = "sin cobertura". */
export function coverageLabel(systemCount: number): "covered" | "single" | "none" {
  if (systemCount === 0) return "none";
  if (systemCount === 1) return "single";
  return "covered";
}
