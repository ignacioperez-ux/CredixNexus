import { describe, it, expect } from "vitest";
import { validateEscalationRule, validateOla } from "./validation";
import { ErrorCode } from "@/lib/validation";

describe("validateEscalationRule", () => {
  const base = { code: "ESC-X", name: "Regla X", slaType: "response", thresholdPct: 80, action: "notify", notifyRole: "support_lead" };
  it("acepta una regla notify valida", () => {
    expect(validateEscalationRule(base)).toBeNull();
  });
  it("rechaza umbral fuera de 1..100", () => {
    expect(validateEscalationRule({ ...base, thresholdPct: 0 })).toBe(ErrorCode.FORMAT);
    expect(validateEscalationRule({ ...base, thresholdPct: 150 })).toBe(ErrorCode.FORMAT);
  });
  it("rechaza tipo de reloj o accion invalidos", () => {
    expect(validateEscalationRule({ ...base, slaType: "foo" })).toBe(ErrorCode.FORMAT);
    expect(validateEscalationRule({ ...base, action: "foo" })).toBe(ErrorCode.FORMAT);
  });
  it("notify exige rol (espeja CHECK de BD)", () => {
    expect(validateEscalationRule({ ...base, notifyRole: "" })).toBe(ErrorCode.REQUIRED);
  });
  it("reassign_team exige equipo destino", () => {
    expect(validateEscalationRule({ code: "ESC-E", name: "Reasignar", slaType: "resolution", thresholdPct: 100, action: "reassign_team" })).toBe(ErrorCode.REQUIRED);
    expect(validateEscalationRule({ code: "ESC-E", name: "Reasignar", slaType: "resolution", thresholdPct: 100, action: "reassign_team", actionTarget: "Operaciones" })).toBeNull();
  });
  it("raise_priority no exige rol ni equipo", () => {
    expect(validateEscalationRule({ code: "ESC-E", name: "Subir", slaType: "response", thresholdPct: 100, action: "raise_priority" })).toBeNull();
  });
});

describe("validateOla", () => {
  it("acepta OLA valida", () => {
    expect(validateOla({ priority: "p3_medium", responseMinutes: 60, resolutionMinutes: 480 })).toBeNull();
  });
  it("rechaza prioridad invalida", () => {
    expect(validateOla({ priority: "p9", responseMinutes: 60, resolutionMinutes: 480 })).toBe(ErrorCode.FORMAT);
  });
  it("rechaza minutos no positivos", () => {
    expect(validateOla({ priority: "p1_critical", responseMinutes: 0, resolutionMinutes: 480 })).toBe(ErrorCode.FORMAT);
  });
  it("resolucion no puede ser mas estricta que la respuesta", () => {
    expect(validateOla({ priority: "p1_critical", responseMinutes: 100, resolutionMinutes: 50 })).toBe(ErrorCode.FORMAT);
  });
});
