import { describe, it, expect } from "vitest";
import { validateTribe, isSquadType } from "./validation";

describe("validateTribe", () => {
  it("requiere codigo y nombre >= 3", () => {
    expect(validateTribe({ code: "", name: "Canales" })).toBeTruthy();
    expect(validateTribe({ code: "CAN", name: "Ca" })).toBeTruthy();
    expect(validateTribe({ code: "CAN", name: "Canales y Cliente" })).toBeNull();
  });
  it("codigo acotado a 40", () => {
    expect(validateTribe({ code: "x".repeat(41), name: "Valida" })).toBeTruthy();
  });
});

describe("isSquadType", () => {
  it("acepta solo domain/enabler/transient", () => {
    expect(isSquadType("domain")).toBe(true);
    expect(isSquadType("enabler")).toBe(true);
    expect(isSquadType("transient")).toBe(true);
    expect(isSquadType("otro")).toBe(false);
  });
});
