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
    expect(serviceHealth({ p1Open: 0, slaBreached: 0, sev1: 0, unackEscalations: 0 })).toEqual({ score: 100, label: "healthy" });
  });
  it("penaliza y clasifica degradado", () => {
    const h = serviceHealth({ p1Open: 3, slaBreached: 3, sev1: 0, unackEscalations: 0 }); // 100-18-12=70
    expect(h.score).toBe(70);
    expect(h.label).toBe("degraded");
  });
  it("un SEV1 empuja a critico", () => {
    const h = serviceHealth({ p1Open: 5, slaBreached: 5, sev1: 1, unackEscalations: 5 }); // 100-30-20-20-5=25
    expect(h.score).toBe(25);
    expect(h.label).toBe("critical");
  });
  it("no baja de 0 ni sube de 100", () => {
    expect(serviceHealth({ p1Open: 100, slaBreached: 100, sev1: 10, unackEscalations: 100 }).score).toBe(0);
  });
});

describe("trendMax", () => {
  it("devuelve el maximo, minimo 1", () => {
    expect(trendMax([{ count: 0 }, { count: 5 }, { count: 3 }])).toBe(5);
    expect(trendMax([{ count: 0 }, { count: 0 }])).toBe(1);
    expect(trendMax([])).toBe(1);
  });
});
