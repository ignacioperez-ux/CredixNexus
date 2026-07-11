import { ErrorCode, required, firstError } from "@/lib/validation";

// Dominio de roster de squad. Logica pura para UI, acciones y pruebas.

export const SQUAD_ROLES = ["lead", "product_owner", "tech_lead", "developer", "qa", "analyst", "scrum_master"] as const;
export type SquadRole = (typeof SQUAD_ROLES)[number];

export type SquadMemberInput = { memberId: string; squadRole: string; allocationPct: number };

export function validateSquadMember(i: SquadMemberInput): string | null {
  return firstError(
    required(i.memberId),
    (SQUAD_ROLES as readonly string[]).includes(i.squadRole) ? null : ErrorCode.FORMAT,
    Number.isInteger(i.allocationPct) && i.allocationPct >= 0 && i.allocationPct <= 100 ? null : ErrorCode.FORMAT,
  );
}
