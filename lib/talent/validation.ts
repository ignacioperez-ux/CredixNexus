import { ErrorCode, minLength, email as vEmail, firstError } from "@/lib/validation";

// Dominio de Talento (profesionales). Logica pura para UI, acciones y pruebas (CLAUDE.md §10.3/§10.7).

export const EXTERNAL_TYPES = ["subcontractor", "intelix"] as const;
export const DISCIPLINES = ["dev", "po", "qa", "ux", "analyst", "support", "ops", "data", "security"] as const;
export const SENIORITIES = ["junior", "mid", "senior", "lead"] as const;

// Tipos de entidad donde un profesional puede tener experiencia (todos maestros reales).
export const EXPERTISE_ENTITIES = ["process", "business_unit", "product", "channel", "configuration_item", "service"] as const;
export type ExpertiseEntity = (typeof EXPERTISE_ENTITIES)[number];

export const EVAL_TYPES = ["general", "incident", "project"] as const;

export type MemberInput = {
  name: string;
  email?: string;
  isExternal: boolean;
  externalType?: string;    // requerido si isExternal
  deliveryAreaId: string;   // stream: operaciones (operador) o evolucion (squads)
  discipline?: string;
  seniority?: string;
  capacityPoints: number;
};

/** Valida un profesional en las tres capas (misma logica en BD/backend/frontend). */
export function validateMember(i: MemberInput): string | null {
  return firstError(
    minLength(i.name, 3),
    i.deliveryAreaId && i.deliveryAreaId.length > 0 ? null : ErrorCode.REQUIRED,
    i.isExternal && !(EXTERNAL_TYPES as readonly string[]).includes(i.externalType ?? "") ? ErrorCode.REQUIRED : null,
    !i.isExternal && i.externalType ? ErrorCode.FORMAT : null,
    i.email && i.email.trim().length > 0 ? vEmail(i.email) : null,
    Number.isInteger(i.capacityPoints) && i.capacityPoints >= 1 && i.capacityPoints <= 40 ? null : ErrorCode.FORMAT,
  );
}

export type SkillInput = { skillId: string; level: number };
export function validateSkill(i: SkillInput): string | null {
  return firstError(
    i.skillId && i.skillId.length > 0 ? null : ErrorCode.REQUIRED,
    Number.isInteger(i.level) && i.level >= 1 && i.level <= 5 ? null : ErrorCode.FORMAT,
  );
}

export type ExpertiseInput = { entityType: string; entityId: string; level: number };
export function validateExpertise(i: ExpertiseInput): string | null {
  return firstError(
    (EXPERTISE_ENTITIES as readonly string[]).includes(i.entityType) ? null : ErrorCode.FORMAT,
    i.entityId && i.entityId.length > 0 ? null : ErrorCode.REQUIRED,
    Number.isInteger(i.level) && i.level >= 1 && i.level <= 5 ? null : ErrorCode.FORMAT,
  );
}

export type EvaluationInput = {
  evalType: string;               // general | incident | project
  effectiveness?: number | null;  // 0-100
  empathy?: number | null;        // 0-100
  comment?: string;
  entityType?: string;
  entityId?: string;
};

/** Una evaluacion exige tipo valido, scores en rango y al menos un dato (score o comentario). */
export function validateEvaluation(i: EvaluationInput): string | null {
  const inRange = (n?: number | null) => n == null || (Number.isFinite(n) && n >= 0 && n <= 100);
  const hasData = i.effectiveness != null || i.empathy != null || !!(i.comment && i.comment.trim().length >= 3);
  return firstError(
    (EVAL_TYPES as readonly string[]).includes(i.evalType) ? null : ErrorCode.FORMAT,
    inRange(i.effectiveness) && inRange(i.empathy) ? null : ErrorCode.FORMAT,
    hasData ? null : ErrorCode.REQUIRED,
    i.evalType !== "general" && !(i.entityId && i.entityId.length > 0) ? ErrorCode.REQUIRED : null,
  );
}
