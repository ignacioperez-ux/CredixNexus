import { describe, it, expect } from "vitest";
import { validateMajorIncident, validateUpdate, canTransition, MI_NEXT } from "./validation";
import { ErrorCode } from "@/lib/validation";

describe("validateMajorIncident", () => {
  it("acepta un incidente mayor valido", () => {
    expect(validateMajorIncident({ title: "Caida de pagos", severity: "sev1" })).toBeNull();
  });
  it("rechaza titulo corto y severidad invalida", () => {
    expect(validateMajorIncident({ title: "x", severity: "sev1" })).toBe(ErrorCode.MIN_LENGTH);
    expect(validateMajorIncident({ title: "Caida de pagos", severity: "sev9" })).toBe(ErrorCode.FORMAT);
  });
});

describe("validateUpdate", () => {
  it("acepta comunicacion valida", () => {
    expect(validateUpdate("customer", "Trabajando en la solucion")).toBeNull();
  });
  it("rechaza tipo invalido o cuerpo vacio", () => {
    expect(validateUpdate("press", "algo")).toBe(ErrorCode.FORMAT);
    expect(validateUpdate("customer", "")).toBe(ErrorCode.REQUIRED);
  });
});

describe("canTransition (mando MI)", () => {
  it("permite el flujo de mando", () => {
    expect(canTransition("declared", "investigating")).toBe(true);
    expect(canTransition("investigating", "mitigating")).toBe(true);
    expect(canTransition("mitigating", "resolved")).toBe(true);
    expect(canTransition("resolved", "stood_down")).toBe(true);
  });
  it("permite reabrir mitigacion desde monitoreo", () => {
    expect(canTransition("monitoring", "mitigating")).toBe(true);
  });
  it("bloquea saltos invalidos", () => {
    expect(canTransition("declared", "resolved")).toBe(false);
    expect(canTransition("stood_down", "mitigating")).toBe(false);
  });
  it("stood_down es terminal", () => {
    expect(MI_NEXT.stood_down).toEqual([]);
  });
});
