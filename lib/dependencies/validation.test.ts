import { describe, it, expect } from "vitest";
import { validateDependencyInput } from "./validation";
import { ErrorCode } from "@/lib/validation";

describe("validateDependencyInput", () => {
  const base = { serviceId: "a", dependsOnId: "b", dependencyType: "sync", criticality: "high" };
  it("acepta una dependencia valida", () => {
    expect(validateDependencyInput(base)).toBeNull();
  });
  it("rechaza auto-dependencia", () => {
    expect(validateDependencyInput({ ...base, dependsOnId: "a" })).toBe(ErrorCode.STATE);
  });
  it("exige ambos servicios", () => {
    expect(validateDependencyInput({ ...base, serviceId: "" })).toBe(ErrorCode.REQUIRED);
    expect(validateDependencyInput({ ...base, dependsOnId: "" })).toBe(ErrorCode.REQUIRED);
  });
  it("rechaza tipo o criticidad invalidos", () => {
    expect(validateDependencyInput({ ...base, dependencyType: "foo" })).toBe(ErrorCode.FORMAT);
    expect(validateDependencyInput({ ...base, criticality: "extreme" })).toBe(ErrorCode.FORMAT);
  });
});
