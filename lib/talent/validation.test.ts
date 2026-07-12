import { describe, it, expect } from "vitest";
import { validateMember, validateSkill, validateExpertise, validateEvaluation } from "./validation";
import { ErrorCode } from "@/lib/validation";

const baseMember = { name: "Ana Perez", isExternal: false, deliveryAreaId: "area-1", capacityPoints: 8 };

describe("validateMember", () => {
  it("acepta un profesional interno valido", () => {
    expect(validateMember(baseMember)).toBeNull();
  });
  it("exige nombre (min 3)", () => {
    expect(validateMember({ ...baseMember, name: "Ab" })).toBe(ErrorCode.MIN_LENGTH);
  });
  it("exige stream (delivery area)", () => {
    expect(validateMember({ ...baseMember, deliveryAreaId: "" })).toBe(ErrorCode.REQUIRED);
  });
  it("externo exige tipo valido", () => {
    expect(validateMember({ ...baseMember, isExternal: true })).toBe(ErrorCode.REQUIRED);
    expect(validateMember({ ...baseMember, isExternal: true, externalType: "otro" })).toBe(ErrorCode.REQUIRED);
    expect(validateMember({ ...baseMember, isExternal: true, externalType: "intelix" })).toBeNull();
  });
  it("interno no puede llevar tipo de externo", () => {
    expect(validateMember({ ...baseMember, externalType: "intelix" })).toBe(ErrorCode.FORMAT);
  });
  it("email invalido falla", () => {
    expect(validateMember({ ...baseMember, email: "no-es-mail" })).toBe(ErrorCode.FORMAT);
    expect(validateMember({ ...baseMember, email: "ana@credix.com" })).toBeNull();
  });
  it("capacidad fuera de rango falla", () => {
    expect(validateMember({ ...baseMember, capacityPoints: 0 })).toBe(ErrorCode.FORMAT);
    expect(validateMember({ ...baseMember, capacityPoints: 41 })).toBe(ErrorCode.FORMAT);
  });
});

describe("validateSkill / validateExpertise", () => {
  it("skill exige nivel 1-5", () => {
    expect(validateSkill({ skillId: "s1", level: 3 })).toBeNull();
    expect(validateSkill({ skillId: "s1", level: 6 })).toBe(ErrorCode.FORMAT);
    expect(validateSkill({ skillId: "", level: 3 })).toBe(ErrorCode.REQUIRED);
  });
  it("experiencia exige entity_type valido", () => {
    expect(validateExpertise({ entityType: "process", entityId: "p1", level: 4 })).toBeNull();
    expect(validateExpertise({ entityType: "planeta", entityId: "p1", level: 4 })).toBe(ErrorCode.FORMAT);
    expect(validateExpertise({ entityType: "product", entityId: "", level: 4 })).toBe(ErrorCode.REQUIRED);
  });
});

describe("validateEvaluation", () => {
  it("general con al menos un score es valida", () => {
    expect(validateEvaluation({ evalType: "general", effectiveness: 90 })).toBeNull();
    expect(validateEvaluation({ evalType: "general", empathy: 80 })).toBeNull();
    expect(validateEvaluation({ evalType: "general", comment: "muy empatico" })).toBeNull();
  });
  it("sin ningun dato falla", () => {
    expect(validateEvaluation({ evalType: "general" })).toBe(ErrorCode.REQUIRED);
  });
  it("score fuera de 0-100 falla", () => {
    expect(validateEvaluation({ evalType: "general", effectiveness: 120 })).toBe(ErrorCode.FORMAT);
    expect(validateEvaluation({ evalType: "general", empathy: -5 })).toBe(ErrorCode.FORMAT);
  });
  it("tipo incidente/proyecto exige entidad", () => {
    expect(validateEvaluation({ evalType: "incident", effectiveness: 80 })).toBe(ErrorCode.REQUIRED);
    expect(validateEvaluation({ evalType: "incident", effectiveness: 80, entityId: "inc-1" })).toBeNull();
  });
});
