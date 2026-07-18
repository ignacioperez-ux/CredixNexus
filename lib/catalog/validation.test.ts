import { describe, it, expect } from "vitest";
import { validateFormData, hasErrors, summarizeFormData, validateItem, validateCategory, normalizeFormSchema, type FormField } from "./validation";
import { ErrorCode } from "@/lib/validation";

const schema: FormField[] = [
  { key: "sistema", label: "Sistema", type: "text", required: true },
  { key: "monto", label: "Monto", type: "number", required: false },
  { key: "reporte", label: "Reporte", type: "select", required: true, options: ["Cartera", "Pagos"] },
  { key: "fecha", label: "Fecha", type: "date", required: false },
];

describe("validateFormData", () => {
  it("acepta datos validos", () => {
    const e = validateFormData(schema, { sistema: "VPOS", reporte: "Pagos", monto: "100", fecha: "2026-07-01" });
    expect(hasErrors(e)).toBe(false);
  });
  it("marca requeridos faltantes", () => {
    const e = validateFormData(schema, { monto: "5" });
    expect(e.sistema).toBe(ErrorCode.REQUIRED);
    expect(e.reporte).toBe(ErrorCode.REQUIRED);
  });
  it("valida numero, select y fecha", () => {
    const e = validateFormData(schema, { sistema: "X", reporte: "Otro", monto: "abc", fecha: "31-12-2026" });
    expect(e.monto).toBe(ErrorCode.FORMAT);
    expect(e.reporte).toBe(ErrorCode.INVALID_REFERENCE);
    expect(e.fecha).toBe(ErrorCode.FORMAT);
  });
  it("campos opcionales vacios no fallan", () => {
    const e = validateFormData(schema, { sistema: "X", reporte: "Cartera" });
    expect(hasErrors(e)).toBe(false);
  });
});

describe("summarizeFormData", () => {
  it("resume etiqueta: valor", () => {
    const s = summarizeFormData([{ key: "a", label: "Sistema", type: "text" }], { a: "VPOS" });
    expect(s).toBe("Sistema: VPOS");
  });
});

describe("validateItem", () => {
  const base = { code: "SR_X", name: "Item X", categoryId: "cat-1", slaHours: 8, formSchema: schema };
  it("acepta item valido", () => {
    expect(validateItem(base)).toBeNull();
  });
  it("rechaza SLA fuera de rango y codigo corto", () => {
    expect(validateItem({ ...base, slaHours: 0 })).toBe(ErrorCode.FORMAT);
    expect(validateItem({ ...base, code: "X" })).toBe(ErrorCode.MIN_LENGTH);
  });
  it("rechaza sin categoria (maestro requerido)", () => {
    expect(validateItem({ ...base, categoryId: "" })).toBe(ErrorCode.REQUIRED);
  });
  it("rechaza select sin opciones", () => {
    expect(validateItem({ ...base, formSchema: [{ key: "r", label: "R", type: "select" }] })).toBe(ErrorCode.FORMAT);
  });
});

describe("validateCategory", () => {
  const c = { code: "acceso", nameEs: "Acceso", nameEn: "Access" };
  it("acepta categoria valida", () => {
    expect(validateCategory(c)).toBeNull();
  });
  it("rechaza codigo corto", () => {
    expect(validateCategory({ ...c, code: "a" })).toBe(ErrorCode.MIN_LENGTH);
  });
  it("rechaza nombres i18n faltantes", () => {
    expect(validateCategory({ ...c, nameEs: "" })).toBe(ErrorCode.REQUIRED);
    expect(validateCategory({ ...c, nameEn: "" })).toBe(ErrorCode.REQUIRED);
  });
});

describe("normalizeFormSchema (fix: campos que se espejaban)", () => {
  it("coerce schema legado con `name` a `key` (cada campo su propio slot)", () => {
    const raw = [
      { name: "sistema", label: "Sistema", type: "text", required: true },
      { name: "perfil", label: "Perfil solicitado", type: "text", required: true },
    ];
    const out = normalizeFormSchema(raw);
    expect(out.map((f) => f.key)).toEqual(["sistema", "perfil"]);
    // Antes del fix: ambos caian en data[undefined] -> se espejaban. Ahora tienen claves distintas.
    expect(new Set(out.map((f) => f.key)).size).toBe(2);
  });
  it("respeta `key` cuando ya existe y descarta campos sin clave", () => {
    const out = normalizeFormSchema([{ key: "a", label: "A", type: "text" }, { label: "sin clave", type: "text" }]);
    expect(out.map((f) => f.key)).toEqual(["a"]);
  });
  it("no-array -> vacio", () => {
    expect(normalizeFormSchema(null)).toEqual([]);
    expect(normalizeFormSchema(undefined)).toEqual([]);
  });
});
