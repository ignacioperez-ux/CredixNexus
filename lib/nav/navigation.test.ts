import { describe, it, expect } from "vitest";
import { MACRO_NAV, ALL_NAV_ITEMS, QUICK_ACTIONS, categoryOfPath } from "./navigation";
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
