import { describe, it, expect } from "vitest";
import { validateProblem, canTransition, PROBLEM_NEXT } from "./validation";
import { ErrorCode } from "@/lib/validation";

describe("validateProblem", () => {
  it("acepta un problema valido", () => {
    expect(validateProblem({ title: "Pasarela inestable", priority: "high" })).toBeNull();
  });
  it("rechaza titulo corto", () => {
    expect(validateProblem({ title: "abc", priority: "low" })).toBe(ErrorCode.MIN_LENGTH);
  });
  it("rechaza prioridad invalida", () => {
    expect(validateProblem({ title: "Titulo suficiente", priority: "urgent" })).toBe(ErrorCode.FORMAT);
  });
  it("error conocido exige causa raiz (espeja CHECK de BD)", () => {
    expect(validateProblem({ title: "Titulo suficiente", priority: "high", knownError: true })).toBe(ErrorCode.REQUIRED);
    expect(validateProblem({ title: "Titulo suficiente", priority: "high", knownError: true, rootCauseSummary: "   " })).toBe(ErrorCode.REQUIRED);
  });
  it("error conocido con causa raiz es valido", () => {
    expect(validateProblem({ title: "Titulo suficiente", priority: "high", knownError: true, rootCauseSummary: "Reintento no idempotente" })).toBeNull();
  });
});

describe("canTransition", () => {
  it("permite transiciones ITIL validas", () => {
    expect(canTransition("new", "investigating")).toBe(true);
    expect(canTransition("investigating", "known_error")).toBe(true);
    expect(canTransition("known_error", "resolved")).toBe(true);
    expect(canTransition("resolved", "closed")).toBe(true);
  });
  it("bloquea saltos ilogicos", () => {
    expect(canTransition("new", "closed")).toBe(false);
    expect(canTransition("new", "resolved")).toBe(false);
    expect(canTransition("closed", "investigating")).toBe(false);
  });
  it("permite reabrir un problema resuelto", () => {
    expect(canTransition("resolved", "investigating")).toBe(true);
  });
  it("un problema cerrado no admite transiciones", () => {
    expect(PROBLEM_NEXT.closed).toEqual([]);
  });
});
