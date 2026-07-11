import { describe, it, expect } from "vitest";
import { tokenize, relevance, scoreCandidate, topMatches } from "./match";

describe("tokenize", () => {
  it("normaliza tildes y descarta stopwords y palabras cortas", () => {
    expect(tokenize("No puedo ingresar con mi contraseña")).toEqual(["puedo", "ingresar", "contrasena"]);
  });
  it("deduplica terminos", () => {
    expect(tokenize("pago pago PAGO")).toEqual(["pago"]);
  });
  it("consulta vacia o trivial da lista vacia", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("de la el")).toEqual([]);
  });
});

describe("relevance", () => {
  const terms = tokenize("restablecer contraseña acceso");
  it("cuenta terminos presentes ignorando tildes", () => {
    expect(relevance("Procedimiento de restablecimiento de contrasena", terms)).toBe(1); // "restablec..." no es igualdad, includes de 'restablecer' no matchea 'restablecimiento'
  });
  it("suma por cada termino contenido", () => {
    expect(relevance("acceso y contraseña del usuario", terms)).toBe(2);
  });
  it("texto nulo o sin terminos da 0", () => {
    expect(relevance(null, terms)).toBe(0);
    expect(relevance("hola", [])).toBe(0);
  });
});

describe("scoreCandidate", () => {
  const terms = tokenize("pago rechazado");
  it("pondera titulo > resumen > cuerpo", () => {
    const soloTitulo = scoreCandidate({ title: "pago rechazado", summary: null, body: null }, terms);
    const soloCuerpo = scoreCandidate({ title: null, summary: null, body: "pago rechazado" }, terms);
    expect(soloTitulo).toBe(6); // 2 terminos * 3
    expect(soloCuerpo).toBe(2); // 2 terminos * 1
    expect(soloTitulo).toBeGreaterThan(soloCuerpo);
  });
});

describe("topMatches", () => {
  it("descarta score 0, ordena desc y corta a N", () => {
    const items = [{ id: "a", score: 0 }, { id: "b", score: 5 }, { id: "c", score: 2 }, { id: "d", score: 9 }];
    expect(topMatches(items, 2).map((i) => i.id)).toEqual(["d", "b"]);
  });
});
