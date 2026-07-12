import { describe, it, expect } from "vitest";
import { canSeeNav, requiredPermForPath, defaultHome, primaryNavKeys } from "./access";

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
  it("dashboard requiere incident.read (no lo ve el usuario final)", () => {
    expect(requiredPermForPath("/dashboard")).toBe("incident.read");
  });
  it("rutas libres devuelven undefined", () => {
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

describe("primaryNavKeys (cockpit por rol)", () => {
  it("admin: null = todo primario", () => {
    expect(primaryNavKeys(["system_admin"], true)).toBeNull();
  });
  it("support_agent: cockpit acotado, incluye dashboard, excluye CMDB/observabilidad", () => {
    const p = primaryNavKeys(["support_agent"], false)!;
    expect(p).not.toBeNull();
    expect(p.has("nav.dashboard")).toBe(true);
    expect(p.has("nav.workspace")).toBe(true);
    expect(p.has("nav.incidents")).toBe(true);
    expect(p.has("nav.dependencies")).toBe(false); // CMDB no es su cockpit
    expect(p.has("nav.observability")).toBe(false);
    expect(p.has("nav.ledger")).toBe(false);
  });
  it("union de multiples roles", () => {
    const p = primaryNavKeys(["support_agent", "product_owner"], false)!;
    expect(p.has("nav.workspace")).toBe(true);   // de support_agent
    expect(p.has("nav.projects")).toBe(true);    // de product_owner
  });
  it("rol sin perfil: null (no oculta nada)", () => {
    expect(primaryNavKeys(["rol_desconocido"], false)).toBeNull();
  });
});
