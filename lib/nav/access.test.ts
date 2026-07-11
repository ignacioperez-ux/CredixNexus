import { describe, it, expect } from "vitest";
import { canSeeNav } from "./access";

describe("canSeeNav", () => {
  const perms = ["incident.read", "fraud.read"];

  it("admin ve todo", () => {
    expect(canSeeNav("risk.read", [], true)).toBe(true);
    expect(canSeeNav(["a", "b"], [], true)).toBe(true);
  });
  it("sin permiso requerido, visible para todos", () => {
    expect(canSeeNav(undefined, [], false)).toBe(true);
  });
  it("permiso exacto: visible solo si lo tiene", () => {
    expect(canSeeNav("incident.read", perms, false)).toBe(true);
    expect(canSeeNav("risk.read", perms, false)).toBe(false);
  });
  it("any-of: visible si tiene al menos uno", () => {
    expect(canSeeNav(["fraud.read", "dispute.read"], perms, false)).toBe(true);
    expect(canSeeNav(["dispute.read", "vendor.read"], perms, false)).toBe(false);
  });
});
