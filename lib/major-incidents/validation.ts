import { ErrorCode, minLength, firstError } from "@/lib/validation";

// Dominio de Major Incident Command (ITIL). Logica pura para UI, acciones y pruebas.

export const SEVERITIES = ["sev1", "sev2", "sev3"] as const;
export const MI_STATUSES = [
  "declared", "investigating", "identified", "mitigating", "monitoring", "resolved", "stood_down",
] as const;
export const UPDATE_TYPES = ["internal", "customer", "stakeholder", "status"] as const;

export type MiStatus = (typeof MI_STATUSES)[number];

/** Maquina de mando del incidente mayor. Permite reabrir mitigacion si reaparece. */
export const MI_NEXT: Record<string, MiStatus[]> = {
  declared: ["investigating"],
  investigating: ["identified", "mitigating"],
  identified: ["mitigating"],
  mitigating: ["monitoring", "resolved"],
  monitoring: ["resolved", "mitigating"],
  resolved: ["stood_down"],
  stood_down: [],
};

export function canTransition(from: string, to: string): boolean {
  return (MI_NEXT[from] ?? []).includes(to as MiStatus);
}

export type MiValidatable = { title: string; severity: string };

export function validateMajorIncident(i: MiValidatable): string | null {
  return firstError(
    minLength(i.title, 5),
    (SEVERITIES as readonly string[]).includes(i.severity) ? null : ErrorCode.FORMAT,
  );
}

export function validateUpdate(updateType: string, body: string): string | null {
  return firstError(
    (UPDATE_TYPES as readonly string[]).includes(updateType) ? null : ErrorCode.FORMAT,
    minLength(body, 3),
  );
}
