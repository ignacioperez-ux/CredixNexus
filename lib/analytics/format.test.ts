import { describe, it, expect } from "vitest";
import { toCsv, serviceHealth, trendMax } from "./format";

describe("toCsv", () => {
  it("genera encabezado y filas", () => {
    expect(toCsv(["a", "b"], [[1, 2], [3, 4]])).toBe("a,b\r\n1,2\r\n3,4");
  });
  it("escapa comas, comillas y saltos de linea", () => {
    expect(toCsv(["x"], [["a,b"]])).toBe('x\r\n"a,b"');
    expect(toCsv(["x"], [['di "hola"']])).toBe('x\r\n"di ""hola"""');
    expect(toCsv(["x"], [["l1\nl2"]])).toBe('x\r\n"l1\nl2"');
  });
  it("trata null/undefined como vacio", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,");
  });
});

describe("serviceHealth", () => {
  it("100 saludable sin senales", () => {
    expect(serviceHealth({ open: 50, p1Open: 0, slaBreached: 0, sev1: 0, unackEscalations: 0 })).toEqual({ score: 100, label: "healthy" });
  });
  it("sin casos abiertos es saludable (sin division por cero)", () => {
    expect(serviceHealth({ open: 0, p1Open: 0, slaBreached: 0, sev1: 0, unackEscalations: 0 })).toEqual({ score: 100, label: "healthy" });
  });
  it("penaliza por TASA y clasifica degradado", () => {
    // 40% de abiertos con SLA vencido: 100 - 0.4*55 = 78
    const h = serviceHealth({ open: 10, p1Open: 0, slaBreached: 4, sev1: 0, unackEscalations: 0 });
    expect(h.score).toBe(78);
    expect(h.label).toBe("degraded");
  });
  it("un SEV1 activo empuja a critico", () => {
    // 100% SLA vencido (-55) + 1 SEV1 (-15) = 30
    const h = serviceHealth({ open: 10, p1Open: 0, slaBreached: 10, sev1: 1, unackEscalations: 0 });
    expect(h.score).toBe(30);
    expect(h.label).toBe("critical");
  });
  it("es robusto a conteos altos: no satura ni baja de 0", () => {
    // conteos > abiertos: cada tasa se topa en 1; SEV1 topa en 30
    const h = serviceHealth({ open: 10, p1Open: 100, slaBreached: 100, sev1: 10, unackEscalations: 100 });
    expect(h.score).toBe(0);
    // volumen realista alto NO satura en 0: 158/166 SLA + 14 P1 + 1 SEV1 -> ~31, critico
    const real = serviceHealth({ open: 166, p1Open: 14, slaBreached: 158, sev1: 1, unackEscalations: 0 });
    expect(real.score).toBeGreaterThan(20);
    expect(real.label).toBe("critical");
  });
});

describe("trendMax", () => {
  it("devuelve el maximo, minimo 1", () => {
    expect(trendMax([{ count: 0 }, { count: 5 }, { count: 3 }])).toBe(5);
    expect(trendMax([{ count: 0 }, { count: 0 }])).toBe(1);
    expect(trendMax([])).toBe(1);
  });
});
