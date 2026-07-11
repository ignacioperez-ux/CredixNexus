import { describe, it, expect } from "vitest";
import { validateChange, canTransition, canDecideCab, CHANGE_NEXT } from "./validation";
import { ErrorCode } from "@/lib/validation";

describe("validateChange", () => {
  const base = { title: "Parche pasarela", changeType: "normal", riskLevel: "high" };
  it("acepta un cambio valido", () => {
    expect(validateChange(base)).toBeNull();
  });
  it("rechaza titulo corto", () => {
    expect(validateChange({ ...base, title: "abc" })).toBe(ErrorCode.MIN_LENGTH);
  });
  it("rechaza tipo o riesgo invalidos", () => {
    expect(validateChange({ ...base, changeType: "foo" })).toBe(ErrorCode.FORMAT);
    expect(validateChange({ ...base, riskLevel: "extreme" })).toBe(ErrorCode.FORMAT);
  });
  it("ventana: fin no puede ser anterior al inicio", () => {
    expect(validateChange({ ...base, plannedStart: "2026-07-10T10:00:00Z", plannedEnd: "2026-07-10T08:00:00Z" })).toBe(ErrorCode.FORMAT);
    expect(validateChange({ ...base, plannedStart: "2026-07-10T08:00:00Z", plannedEnd: "2026-07-10T10:00:00Z" })).toBeNull();
  });
});

describe("canTransition / canDecideCab", () => {
  it("permite transiciones ITIL validas", () => {
    expect(canTransition("draft", "assessment")).toBe(true);
    expect(canTransition("assessment", "pending_cab")).toBe(true);
    expect(canTransition("approved", "scheduled")).toBe(true);
    expect(canTransition("implementing", "review")).toBe(true);
    expect(canTransition("review", "closed")).toBe(true);
  });
  it("bloquea saltos ilogicos", () => {
    expect(canTransition("draft", "approved")).toBe(false);
    expect(canTransition("pending_cab", "approved")).toBe(false); // solo via CAB
    expect(canTransition("closed", "assessment")).toBe(false);
  });
  it("permite cancelar desde estados no terminales", () => {
    expect(canTransition("assessment", "cancelled")).toBe(true);
    expect(canTransition("implementing", "cancelled")).toBe(true);
  });
  it("la decision CAB solo aplica en pending_cab", () => {
    expect(canDecideCab("pending_cab")).toBe(true);
    expect(canDecideCab("assessment")).toBe(false);
    expect(canDecideCab("approved")).toBe(false);
  });
  it("estados terminales sin transiciones", () => {
    expect(CHANGE_NEXT.closed).toEqual([]);
    expect(CHANGE_NEXT.cancelled).toEqual([]);
  });
});
