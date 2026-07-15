import { ErrorCode, minLength, firstError } from "@/lib/validation";

// Dominio Tribu (Fase 1). Logica pura para UI, acciones y pruebas (§10.3/§10.7).
export const SQUAD_TYPES = ["domain", "enabler", "transient"] as const;
export type SquadType = (typeof SQUAD_TYPES)[number];

export type TribeInput = {
  code: string;
  name: string;
  mission?: string;
  valueStream?: string;
  objective?: string;
  tribeLeadUserId?: string;
};

export function validateTribe(i: TribeInput): string | null {
  return firstError(
    i.code && i.code.trim().length > 0 ? null : ErrorCode.REQUIRED,
    i.code && i.code.trim().length <= 40 ? null : ErrorCode.FORMAT,
    minLength(i.name, 3),
  );
}

export function isSquadType(v: string): v is SquadType {
  return (SQUAD_TYPES as readonly string[]).includes(v);
}
