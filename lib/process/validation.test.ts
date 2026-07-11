import { describe, it, expect } from "vitest";
import { validateProcessSystem, validateProductChannel, matrixDensity, coverageLabel } from "./validation";
import { ErrorCode } from "@/lib/validation";

describe("validateProcessSystem", () => {
  const base = { processId: "p1", ciId: "c1", role: "primary", criticality: "high" };
  it("acepta vinculo valido", () => expect(validateProcessSystem(base)).toBeNull());
  it("exige proceso y sistema", () => {
    expect(validateProcessSystem({ ...base, processId: "" })).toBe(ErrorCode.REQUIRED);
    expect(validateProcessSystem({ ...base, ciId: "" })).toBe(ErrorCode.REQUIRED);
  });
  it("rechaza rol o criticidad invalidos", () => {
    expect(validateProcessSystem({ ...base, role: "boss" })).toBe(ErrorCode.FORMAT);
    expect(validateProcessSystem({ ...base, criticality: "extreme" })).toBe(ErrorCode.FORMAT);
  });
});

describe("validateProductChannel", () => {
  const base = { productId: "pr1", channelId: "ch1", availability: "active" };
  it("acepta valido y rechaza availability invalida", () => {
    expect(validateProductChannel(base)).toBeNull();
    expect(validateProductChannel({ ...base, availability: "beta" })).toBe(ErrorCode.FORMAT);
    expect(validateProductChannel({ ...base, productId: "" })).toBe(ErrorCode.REQUIRED);
  });
});

describe("matrixDensity", () => {
  it("celdas cubiertas sobre total", () => {
    expect(matrixDensity(4, 2, 8)).toBe(25); // 4/16
    expect(matrixDensity(0, 0, 5)).toBeNull();
  });
});

describe("coverageLabel", () => {
  it("clasifica por cantidad de sistemas", () => {
    expect(coverageLabel(0)).toBe("none");
    expect(coverageLabel(1)).toBe("single");
    expect(coverageLabel(3)).toBe("covered");
  });
});
