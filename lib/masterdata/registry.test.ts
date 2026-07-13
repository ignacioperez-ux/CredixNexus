import { describe, it, expect } from "vitest";
import { CATALOGS, getCatalog } from "./registry";
import { dictionaries } from "@/lib/i18n/dictionaries";

// Integridad del registro de datos maestros (§10.11): cada catalogo debe estar
// bien formado, con i18n ES/EN, para que el CRUD generico funcione sin sorpresas.

const es = dictionaries.es as Record<string, string>;
const en = dictionaries.en as Record<string, string>;

describe("registry de datos maestros", () => {
  it("no repite key ni table entre catalogos", () => {
    const keys = CATALOGS.map((c) => c.key);
    const tables = CATALOGS.map((c) => c.table);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it("cada catalogo tiene campos code y name", () => {
    for (const c of CATALOGS) {
      const names = c.fields.map((f) => f.name);
      expect(names, c.key).toContain("code");
      expect(names, c.key).toContain("name");
    }
  });

  it("los tipos de campo son coherentes (enum->options, fk->fkTable)", () => {
    for (const c of CATALOGS) {
      for (const f of c.fields) {
        if (f.type === "enum") expect((f.options ?? []).length, `${c.key}.${f.name}`).toBeGreaterThan(0);
        if (f.type === "fk") expect(f.fkTable, `${c.key}.${f.name}`).toBeTruthy();
        if (f.type === "code") expect(f.name, `${c.key}`).toBe("code");
      }
    }
  });

  it("listCols referencian campos declarados del catalogo", () => {
    for (const c of CATALOGS) {
      const names = new Set(c.fields.map((f) => f.name));
      for (const col of c.listCols) expect(names.has(col), `${c.key}.${col}`).toBe(true);
    }
  });

  it("cada titulo, grupo y label tiene traduccion en ES y EN", () => {
    for (const c of CATALOGS) {
      expect(es[c.title], `ES ${c.title}`).toBeTruthy();
      expect(en[c.title], `EN ${c.title}`).toBeTruthy();
      expect(es[c.group], `ES ${c.group}`).toBeTruthy();
      expect(en[c.group], `EN ${c.group}`).toBeTruthy();
      for (const f of c.fields) {
        expect(es[f.label], `ES ${f.label}`).toBeTruthy();
        expect(en[f.label], `EN ${f.label}`).toBeTruthy();
      }
    }
  });

  it("registra los maestros que antes no tenian pantalla de alta", () => {
    for (const key of ["systems", "case-types", "governance-items"]) {
      expect(getCatalog(key), key).toBeDefined();
    }
    expect(getCatalog("systems")?.table).toBe("configuration_item");
    expect(getCatalog("case-types")?.table).toBe("case_type");
    expect(getCatalog("governance-items")?.table).toBe("governance_item");
  });
});
