import { describe, it, expect } from "vitest";
import { computeRoi } from "./queries";

describe("computeRoi", () => {
  it("calcula ROI = (beneficio - costo) / costo en %", () => {
    expect(computeRoi(25_000_000, 6_000_000)).toBe(317); // round(316.67)
    expect(computeRoi(200, 100)).toBe(100);
    expect(computeRoi(100, 100)).toBe(0);
  });
  it("null si hay beneficio pero costo 0", () => {
    expect(computeRoi(100, 0)).toBeNull();
  });
  it("0 si no hay beneficio ni costo", () => {
    expect(computeRoi(0, 0)).toBe(0);
  });
  it("ROI negativo si el costo supera el beneficio", () => {
    expect(computeRoi(50, 100)).toBe(-50);
  });
});
