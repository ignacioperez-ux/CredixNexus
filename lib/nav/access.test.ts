import { describe, it, expect } from "vitest";
import { canSeeNav, requiredPermForPath, defaultHome, solePersona, isRouteDeniedForRoles } from "./access";

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

describe("solePersona", () => {
  it("una sola persona interna -> esa persona", () => {
    expect(solePersona(["support_agent"])).toBe("support_agent");
    expect(solePersona(["support_lead"])).toBe("support_lead");
    // Persona + rol adyacente NO-persona (business_owner) sigue siendo persona unica.
    expect(solePersona(["support_agent", "business_owner"])).toBe("support_agent");
  });
  it("multi-persona (2+) -> null (power-user)", () => {
    expect(solePersona(["product_owner", "support_agent"])).toBeNull();
    expect(solePersona(["support_lead", "product_owner"])).toBeNull();
  });
  it("sin persona interna -> null", () => {
    expect(solePersona(["business_owner"])).toBeNull();
    expect(solePersona([])).toBeNull();
  });
});

describe("isRouteDeniedForRoles (segregacion de persona; multi-persona NO se restringe)", () => {
  it("Operador (persona unica): rutas de gestion vedadas; su detalle de caso no", () => {
    expect(isRouteDeniedForRoles("/dashboard", ["support_agent"])).toBe(true);
    expect(isRouteDeniedForRoles("/projects", ["support_agent"])).toBe(true);
    expect(isRouteDeniedForRoles("/incidents/abc", ["support_agent"])).toBe(false); // ve su caso
    expect(isRouteDeniedForRoles("/knowledge", ["support_agent"])).toBe(false);
  });
  it("Gte. Operaciones (persona unica): Evolucion/reglas vedadas; su triage no", () => {
    expect(isRouteDeniedForRoles("/evolucion", ["support_lead"])).toBe(true);
    expect(isRouteDeniedForRoles("/rules", ["support_lead"])).toBe(true);
    expect(isRouteDeniedForRoles("/triage", ["support_lead"])).toBe(false);
  });
  it("multi-persona (product_owner + support_agent): NO se restringe por persona", () => {
    expect(isRouteDeniedForRoles("/dashboard", ["product_owner", "support_agent"])).toBe(false);
    expect(isRouteDeniedForRoles("/projects", ["product_owner", "support_agent"])).toBe(false);
    expect(isRouteDeniedForRoles("/evolucion", ["support_lead", "product_owner"])).toBe(false);
  });
  it("sin persona interna declarada -> sin denylist de persona", () => {
    expect(isRouteDeniedForRoles("/dashboard", ["business_owner"])).toBe(false);
  });
});
