import { describe, it, expect } from "vitest";
import { validateSquadMember, SQUAD_ROLES } from "./validation";
import { ErrorCode } from "@/lib/validation";

describe("validateSquadMember", () => {
  const base = { memberId: "m1", squadRole: "developer", allocationPct: 100 };
  it("acepta una membresia valida", () => {
    expect(validateSquadMember(base)).toBeNull();
  });
  it("exige miembro", () => {
    expect(validateSquadMember({ ...base, memberId: "" })).toBe(ErrorCode.REQUIRED);
  });
  it("rechaza rol fuera del set", () => {
    expect(validateSquadMember({ ...base, squadRole: "manager" })).toBe(ErrorCode.FORMAT);
  });
  it("acepta todos los roles definidos", () => {
    for (const r of SQUAD_ROLES) expect(validateSquadMember({ ...base, squadRole: r })).toBeNull();
  });
  it("acota la asignacion a 0..100", () => {
    expect(validateSquadMember({ ...base, allocationPct: -1 })).toBe(ErrorCode.FORMAT);
    expect(validateSquadMember({ ...base, allocationPct: 150 })).toBe(ErrorCode.FORMAT);
    expect(validateSquadMember({ ...base, allocationPct: 50 })).toBeNull();
  });
});
