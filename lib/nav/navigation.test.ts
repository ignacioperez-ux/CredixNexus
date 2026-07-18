import { describe, it, expect } from "vitest";
import { MACRO_NAV, ALL_NAV_ITEMS, QUICK_ACTIONS, categoryOfPath, EVOLUTION_NAV, OPERATIONS_NAV, SUPPORT_AGENT_NAV, SQUAD_MEMBER_NAV, USER_NAV, navForRoles } from "./navigation";
import { dictionaries } from "@/lib/i18n/dictionaries";

// Integridad de la navegacion macro (FASE 1): 8 categorias, i18n ES/EN completo,
// rutas e ids unicos, y mapeo ruta->categoria correcto.

const es = dictionaries.es as Record<string, string>;
const en = dictionaries.en as Record<string, string>;
const ICONS = ["home", "inbox", "sliders", "zap", "users", "sparkle", "activity", "gear"];

describe("navegacion macro", () => {
  it("tiene exactamente las 8 categorias aprobadas en orden", () => {
    expect(MACRO_NAV.map((c) => c.id)).toEqual([
      "inicio", "tickets", "operaciones", "evolucion", "talento", "conocimiento", "analitica", "administracion",
    ]);
  });

  it("cada categoria usa un icono lucide conocido y tiene i18n ES/EN", () => {
    for (const c of MACRO_NAV) {
      expect(ICONS, c.id).toContain(c.icon);
      expect(es[c.label], `ES ${c.label}`).toBeTruthy();
      expect(en[c.label], `EN ${c.label}`).toBeTruthy();
    }
  });

  it("no repite ids ni rutas entre items", () => {
    const ids = ALL_NAV_ITEMS.map((i) => i.id);
    const paths = ALL_NAV_ITEMS.map((i) => i.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("cada item de navegacion tiene label i18n ES/EN y ruta absoluta", () => {
    for (const i of ALL_NAV_ITEMS) {
      expect(es[i.label], `ES ${i.label}`).toBeTruthy();
      expect(en[i.label], `EN ${i.label}`).toBeTruthy();
      expect(i.path.startsWith("/"), i.id).toBe(true);
    }
  });

  it("las acciones rapidas tienen i18n y ruta /new", () => {
    for (const a of QUICK_ACTIONS) {
      expect(es[a.label], `ES ${a.label}`).toBeTruthy();
      expect(en[a.label], `EN ${a.label}`).toBeTruthy();
      expect(a.path.endsWith("/new"), a.id).toBe(true);
    }
  });

  it("categoryOfPath ubica rutas conocidas y detalle bajo su categoria", () => {
    expect(categoryOfPath("/incidents")).toBe("tickets");
    expect(categoryOfPath("/incidents/abc-123")).toBe("tickets");
    expect(categoryOfPath("/projects")).toBe("evolucion");
    expect(categoryOfPath("/catalog")).toBe("administracion");
    expect(categoryOfPath("/no-existe")).toBeNull();
  });
});

// Navegacion de persona (Fase Evolucion 1.2): overlay del Gerente de Evolucion.
describe("navegacion de persona (EVOLUTION_NAV / navForRoles)", () => {
  const ITEM_BY_ID = Object.fromEntries(ALL_NAV_ITEMS.map((i) => [i.id, i]));

  it("cada item del overlay reusa un item canonico (mismo path y perm; nada inventado)", () => {
    for (const cat of EVOLUTION_NAV) {
      for (const it of cat.items) {
        const base = ITEM_BY_ID[it.id];
        expect(base, it.id).toBeDefined();
        expect(it.path).toBe(base.path);
        expect(it.perm).toEqual(base.perm);
      }
    }
  });

  it("las categorias del overlay tienen i18n ES/EN", () => {
    for (const c of EVOLUTION_NAV) {
      expect(es[c.label], `ES ${c.label}`).toBeTruthy();
      expect(en[c.label], `EN ${c.label}`).toBeTruthy();
    }
    expect(es["nav.readonly"]).toBeTruthy();
    expect(en["nav.readonly"]).toBeTruthy();
  });

  it("problemas y cambios son solo-lectura; incidentes mayores accionable (ambas areas)", () => {
    const casos = EVOLUTION_NAV.find((c) => c.id === "ev.analisis360")!;
    expect(casos.items.find((i) => i.id === "nav.problems")?.readOnly).toBe(true);
    expect(casos.items.find((i) => i.id === "nav.changes")?.readOnly).toBe(true);
    expect(casos.items.find((i) => i.id === "nav.majorincidents")?.readOnly).toBeFalsy();
  });

  it("los overrides de etiqueta NO alteran path ni perm del item canonico", () => {
    const analisis = EVOLUTION_NAV.find((c) => c.id === "ev.analisis360")!;
    const analytics = analisis.items.find((i) => i.id === "nav.analytics")!;
    expect(analytics.label).toBe("nav.evx.analytics");        // etiqueta override
    expect(analytics.path).toBe("/analytics");                // path canonico intacto
    expect(analytics.perm).toEqual(["incident.read", "analytics.read"]);
  });

  it("navForRoles: overlay de persona por rol operativo; admin -> MACRO_NAV", () => {
    expect(navForRoles(["product_owner"], false)).toBe(EVOLUTION_NAV);
    expect(navForRoles(["product_owner"], true)).toBe(MACRO_NAV);            // admin ve todo
    // Prioridad de overlay (navForRoles): support_lead > support_agent > product_owner > squad_member.
    // Un multi-rol operativo toma el overlay mas prioritario (segregacion de persona), no MACRO_NAV.
    expect(navForRoles(["product_owner", "support_agent"], false)).toBe(SUPPORT_AGENT_NAV);
    expect(navForRoles(["support_lead"], false)).toBe(OPERATIONS_NAV);
    expect(navForRoles(["support_agent"], false)).toBe(SUPPORT_AGENT_NAV);
    expect(navForRoles(["squad_member"], false)).toBe(SQUAD_MEMBER_NAV);
    expect(navForRoles(["partner_user"], false)).toBe(USER_NAV);
  });
});
