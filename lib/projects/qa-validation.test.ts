import { describe, it, expect } from "vitest";
import { validateValidationRun, canQaTransition, canAuthorizeProduction, QA_NEXT } from "./qa-validation";
import { ErrorCode } from "@/lib/validation";

describe("validateValidationRun", () => {
  const base = { name: "Regresion pagos", testType: "regression", environment: "test", result: "pass" };
  it("acepta una corrida valida", () => {
    expect(validateValidationRun(base)).toBeNull();
  });
  it("rechaza nombre corto", () => {
    expect(validateValidationRun({ ...base, name: "x" })).toBe(ErrorCode.MIN_LENGTH);
  });
  it("rechaza tipo/ambiente/resultado invalidos", () => {
    expect(validateValidationRun({ ...base, testType: "foo" })).toBe(ErrorCode.FORMAT);
    expect(validateValidationRun({ ...base, environment: "prod" })).toBe(ErrorCode.FORMAT);
    expect(validateValidationRun({ ...base, result: "ok" })).toBe(ErrorCode.FORMAT);
  });
});

describe("canQaTransition", () => {
  it("sigue el flujo de calidad", () => {
    expect(canQaTransition("pending", "in_testing")).toBe(true);
    expect(canQaTransition("in_testing", "passed")).toBe(true);
    expect(canQaTransition("in_testing", "failed")).toBe(true);
    expect(canQaTransition("failed", "in_testing")).toBe(true);
  });
  it("bloquea saltos invalidos", () => {
    expect(canQaTransition("pending", "passed")).toBe(false);
    expect(QA_NEXT.passed).toEqual(["in_testing"]);
  });
});

describe("canAuthorizeProduction", () => {
  it("solo con calidad aprobada", () => {
    expect(canAuthorizeProduction("passed")).toBe(true);
    expect(canAuthorizeProduction("in_testing")).toBe(false);
    expect(canAuthorizeProduction("failed")).toBe(false);
    expect(canAuthorizeProduction("pending")).toBe(false);
  });
});
