import { describe, it, expect } from "vitest";
import { validateClassification, validateDiscard, routesToEvolution } from "./validation";
import { ErrorCode } from "@/lib/validation";

describe("validateClassification", () => {
  it("acepta las clasificaciones validas", () => {
    for (const c of ["incident", "improvement", "project"]) expect(validateClassification(c)).toBeNull();
  });
  it("rechaza otra cosa", () => {
    expect(validateClassification("idea")).toBe(ErrorCode.FORMAT);
  });
});

describe("routesToEvolution", () => {
  it("mejora y proyecto van a Evolucion", () => {
    expect(routesToEvolution("improvement")).toBe(true);
    expect(routesToEvolution("project")).toBe(true);
  });
  it("incidencia queda en Operaciones", () => {
    expect(routesToEvolution("incident")).toBe(false);
  });
});

describe("validateDiscard", () => {
  it("exige un motivo con contenido", () => {
    expect(validateDiscard("")).toBe(ErrorCode.REQUIRED);
    expect(validateDiscard("no")).toBe(ErrorCode.MIN_LENGTH);
    expect(validateDiscard("No corresponde a ningun tipo de caso")).toBeNull();
  });
});
