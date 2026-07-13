import { describe, it, expect } from "vitest";
import { ROLE_UX, emphasisForRoles, homeForRoles, resolveHome, unknownEmphasisIds } from "./role-ux";

// Cockpit por rol (FASE 2): el enfasis se declara a nivel de categoria macro y controla
// solo la auto-expansion; la visibilidad la sigue gobernando `perm`.

describe("ROLE_UX / emphasisForRoles", () => {
  it("todos los ids de emphasis son categorias macro validas", () => {
    expect(unknownEmphasisIds()).toEqual([]);
  });

  it("admin no fuerza enfasis (ve todo; solo se abre la activa)", () => {
    expect([...emphasisForRoles(["system_admin"], true)]).toEqual([]);
    expect([...emphasisForRoles([], true)]).toEqual([]);
  });

  it("Gte. Operaciones -> Tickets/Operaciones/Analitica (Command Center)", () => {
    const e = emphasisForRoles(["support_lead"], false);
    expect(e.has("tickets")).toBe(true);
    expect(e.has("operaciones")).toBe(true);
    expect(e.has("analitica")).toBe(true);
    expect(e.has("administracion")).toBe(false);
  });

  it("Operador -> Inicio/Tickets/Conocimiento; no Operaciones ni Admin", () => {
    const e = emphasisForRoles(["support_agent"], false);
    expect(e.has("inicio")).toBe(true);
    expect(e.has("tickets")).toBe(true);
    expect(e.has("conocimiento")).toBe(true);
    expect(e.has("operaciones")).toBe(false);
    expect(e.has("administracion")).toBe(false);
  });

  it("Squad -> Evolucion/Conocimiento (Delivery Hub)", () => {
    const e = emphasisForRoles(["squad_member"], false);
    expect(e.has("evolucion")).toBe(true);
    expect(e.has("conocimiento")).toBe(true);
    expect(e.has("tickets")).toBe(false);
  });

  it("Usuario final -> Tickets/Conocimiento (simple)", () => {
    const e = emphasisForRoles(["partner_user"], false);
    expect(e.has("tickets")).toBe(true);
    expect(e.has("conocimiento")).toBe(true);
    expect(e.has("administracion")).toBe(false);
  });

  it("union de multiples roles suma sus enfasis", () => {
    const e = emphasisForRoles(["support_agent", "product_owner"], false);
    expect(e.has("tickets")).toBe(true);    // support_agent
    expect(e.has("evolucion")).toBe(true);  // product_owner
  });

  it("rol desconocido -> sin enfasis (solo se abre la activa)", () => {
    expect([...emphasisForRoles(["rol_x"], false)]).toEqual([]);
  });

  it("homeForRoles devuelve el landing del primer rol con home", () => {
    expect(homeForRoles(["support_agent"])).toBe("/workspace");
    expect(homeForRoles(["squad_member"])).toBe("/projects");
    expect(homeForRoles(["rol_x"])).toBeNull();
  });

  it("las 6 personas principales tienen experiencia declarada", () => {
    for (const r of ["system_admin", "support_lead", "support_agent", "product_owner", "squad_member", "partner_user"]) {
      expect(ROLE_UX[r], r).toBeDefined();
    }
  });

  describe("resolveHome (landing con guardia de permiso)", () => {
    it("admin -> su home declarado", () => {
      expect(resolveHome(["system_admin"], [], true)).toBe("/dashboard");
    });
    it("usa el home del rol si el usuario puede abrirlo", () => {
      expect(resolveHome(["support_agent"], ["incident.read"], false)).toBe("/workspace");
      expect(resolveHome(["squad_member"], ["project.read"], false)).toBe("/projects");
    });
    it("cae al heuristico si el home del rol no es accesible por permiso", () => {
      // support_agent.home=/workspace exige incident.read; sin el, fallback -> /portal
      expect(resolveHome(["support_agent"], [], false)).toBe("/portal");
    });
    it("rol sin home declarado -> heuristico por permisos", () => {
      expect(resolveHome(["rol_x"], ["incident.read"], false)).toBe("/workspace");
    });
  });
});
