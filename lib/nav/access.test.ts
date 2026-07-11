import { describe, it, expect } from "vitest";
import { canSeeNav, requiredPermForPath, defaultHome } from "./access";

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

describe("requiredPermForPath", () => {
  it("resuelve por prefijo (detalle incluido)", () => {
    expect(requiredPermForPath("/incidents")).toBe("incident.read");
    expect(requiredPermForPath("/incidents/abc-123")).toBe("incident.read");
    expect(requiredPermForPath("/ledger")).toBe("audit.read");
    expect(requiredPermForPath("/fraud-disputes/fraud/x")).toEqual(["fraud.read", "dispute.read"]);
  });
  it("rutas libres devuelven undefined", () => {
    expect(requiredPermForPath("/dashboard")).toBeUndefined();
    expect(requiredPermForPath("/unauthorized")).toBeUndefined();
    expect(requiredPermForPath("/portal")).toBeUndefined();
  });
});

describe("defaultHome", () => {
  it("admin al dashboard", () => {
    expect(defaultHome([], true)).toBe("/dashboard");
  });
  it("agente/operaciones al workspace", () => {
    expect(defaultHome(["incident.read"], false)).toBe("/workspace");
  });
  it("evolucion/squad a proyectos", () => {
    expect(defaultHome(["project.read"], false)).toBe("/projects");
    expect(defaultHome(["squad.read"], false)).toBe("/projects");
  });
  it("usuario final al portal", () => {
    expect(defaultHome(["service_catalog.request"], false)).toBe("/portal");
    expect(defaultHome([], false)).toBe("/portal");
  });
});
