import { describe, it, expect } from "vitest";
import { extractJson, clampPct, normalizeEnum } from "./parse";

describe("extractJson", () => {
  it("parsea JSON limpio", () => {
    expect(extractJson('{"code":"A","confidence":80}')).toEqual({ code: "A", confidence: 80 });
  });
  it("tolera fences ```json y texto alrededor", () => {
    const t = 'Aqui esta:\n```json\n{"code":"B"}\n```\nGracias';
    expect(extractJson(t)).toEqual({ code: "B" });
  });
  it("parsea arreglos", () => {
    expect(extractJson('[{"number":"INC-1"},{"number":"INC-2"}]')).toEqual([{ number: "INC-1" }, { number: "INC-2" }]);
  });
  it("devuelve null si no hay JSON o es invalido", () => {
    expect(extractJson("sin json aqui")).toBeNull();
    expect(extractJson("{roto")).toBeNull();
  });
});

describe("clampPct", () => {
  it("acota a 0..100 y redondea", () => {
    expect(clampPct(80.4)).toBe(80);
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(150)).toBe(100);
    expect(clampPct(NaN)).toBe(0);
  });
});

describe("normalizeEnum", () => {
  it("respeta valores validos", () => {
    expect(normalizeEnum("negative", ["negative", "neutral", "positive"])).toBe("negative");
  });
  it("cae al valor central si es invalido", () => {
    expect(normalizeEnum("furioso", ["negative", "neutral", "positive"])).toBe("neutral");
    expect(normalizeEnum("x", ["low", "medium", "high"])).toBe("medium");
  });
});
