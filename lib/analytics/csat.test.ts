import { describe, it, expect } from "vitest";
import { csatLabel, satisfiedLabel, isLowCsat } from "./csat";

const mk = (avg: number, responses: number, pct: number) => ({ csat_avg: avg, csat_responses: responses, csat_satisfied_pct: pct });

describe("csatLabel", () => {
  it("muestra promedio y n cuando hay respuestas", () => {
    expect(csatLabel(mk(4.5, 4, 100))).toBe("4.5★ (4)");
  });
  it("guion cuando no hay respuestas", () => {
    expect(csatLabel(mk(0, 0, 0))).toBe("—");
  });
});

describe("satisfiedLabel", () => {
  it("porcentaje o guion", () => {
    expect(satisfiedLabel(mk(4.5, 4, 100))).toBe("100%");
    expect(satisfiedLabel(mk(0, 0, 0))).toBe("—");
  });
});

describe("isLowCsat", () => {
  it("marca CSAT bajo solo con respuestas", () => {
    expect(isLowCsat(mk(3.2, 5, 40))).toBe(true);
    expect(isLowCsat(mk(4.5, 5, 100))).toBe(false);
    expect(isLowCsat(mk(0, 0, 0))).toBe(false); // sin respuestas no es "bajo"
  });
});
