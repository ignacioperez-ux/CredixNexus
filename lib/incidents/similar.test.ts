import { describe, it, expect } from "vitest";
import { rankSimilar, SIMILAR_MIN, type CandidateRow } from "./similar";

// Fila candidata de ayuda para las pruebas (defaults abiertos, sin categoria/CI).
function cand(p: Partial<CandidateRow> & { id: string; title: string }): CandidateRow {
  return { incident_number: `INC-${p.id}`, description: null, status: "new", category_id: null, affected_ci_id: null, ...p };
}

describe("rankSimilar", () => {
  it("borrador sin terminos significativos da vacio", () => {
    expect(rankSimilar({ title: "de la el" }, [cand({ id: "1", title: "pago rechazado" })])).toEqual([]);
  });

  it("matchea por solape de titulo sobre el umbral", () => {
    const draft = { title: "pago rechazado en la app" };
    const hits = rankSimilar(draft, [
      cand({ id: "1", title: "Pago rechazado al cliente" }), // 2 terminos * 3 = 6
      cand({ id: "2", title: "Error de acceso al portal" }), // 0
    ]);
    expect(hits.map((h) => h.id)).toEqual(["1"]);
    expect(hits[0].score).toBeGreaterThanOrEqual(SIMILAR_MIN);
  });

  it("un solo termino en el cuerpo no alcanza el umbral (evita falsos positivos)", () => {
    // score textual = 1 (1 termino * cuerpo), sin refuerzos -> < SIMILAR_MIN (2)
    const hits = rankSimilar({ title: "pago duplicado" }, [cand({ id: "1", title: "otro tema", description: "hubo un pago" })]);
    expect(hits).toEqual([]);
  });

  it("misma categoria refuerza un match textual debil hasta superar el umbral", () => {
    const draft = { title: "pago tardio", categoryId: "cat-A" };
    // texto = 1 (solo 'pago' en cuerpo) + boost categoria 2 = 3 >= 2
    const conCategoria = rankSimilar(draft, [cand({ id: "1", title: "consulta", description: "un pago", category_id: "cat-A" })]);
    const sinCategoria = rankSimilar(draft, [cand({ id: "1", title: "consulta", description: "un pago", category_id: "cat-B" })]);
    expect(conCategoria.map((h) => h.id)).toEqual(["1"]);
    expect(conCategoria[0].sameCategory).toBe(true);
    expect(sinCategoria).toEqual([]); // sin el refuerzo no llega al umbral
  });

  it("misma aplicacion (CI) tambien refuerza", () => {
    const draft = { title: "falla intermitente", affectedCiId: "ci-9" };
    const hits = rankSimilar(draft, [cand({ id: "1", title: "algo", description: "falla en el sistema", affected_ci_id: "ci-9" })]);
    expect(hits[0]?.sameCi).toBe(true);
    expect(hits[0]?.score).toBeGreaterThanOrEqual(SIMILAR_MIN);
  });

  it("solo categoria/CI sin solape textual NO es duplicado", () => {
    const draft = { title: "pago rechazado", categoryId: "cat-A", affectedCiId: "ci-9" };
    const hits = rankSimilar(draft, [cand({ id: "1", title: "tema totalmente distinto", description: "nada que ver", category_id: "cat-A", affected_ci_id: "ci-9" })]);
    expect(hits).toEqual([]);
  });

  it("excluye el propio caso (excludeId) al editar", () => {
    const draft = { title: "pago rechazado", excludeId: "1" };
    const hits = rankSimilar(draft, [cand({ id: "1", title: "pago rechazado" }), cand({ id: "2", title: "pago rechazado" })]);
    expect(hits.map((h) => h.id)).toEqual(["2"]);
  });

  it("ordena por score desc y corta al limite", () => {
    const draft = { title: "pago rechazado duplicado" };
    const hits = rankSimilar(
      draft,
      [
        cand({ id: "weak", title: "pago", description: "pago" }), // menor
        cand({ id: "strong", title: "pago rechazado duplicado" }), // 3 terminos * 3 = 9
        cand({ id: "mid", title: "pago rechazado" }), // 2 * 3 = 6
      ],
      2,
    );
    expect(hits.map((h) => h.id)).toEqual(["strong", "mid"]);
  });
});
