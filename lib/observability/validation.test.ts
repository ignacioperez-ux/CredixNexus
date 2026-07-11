import { describe, it, expect } from "vitest";
import {
  severityToImpactUrgency,
  validateAcknowledge,
  validateResolve,
  validateCorrelate,
  validateCreateCase,
} from "./validation";
import { derivePriority } from "@/lib/incidents/priority";
import { ErrorCode } from "@/lib/validation";

describe("severityToImpactUrgency + prioridad", () => {
  it("critical -> p1_critical", () => {
    const { impact, urgency } = severityToImpactUrgency("critical");
    expect(derivePriority(impact, urgency)).toBe("p1_critical");
  });
  it("high -> p2_high", () => {
    const { impact, urgency } = severityToImpactUrgency("high");
    expect(derivePriority(impact, urgency)).toBe("p2_high");
  });
  it("medium -> p3_medium", () => {
    const { impact, urgency } = severityToImpactUrgency("medium");
    expect(derivePriority(impact, urgency)).toBe("p3_medium");
  });
  it("low e info -> p4_low", () => {
    expect(derivePriority(...tuple(severityToImpactUrgency("low")))).toBe("p4_low");
    expect(derivePriority(...tuple(severityToImpactUrgency("info")))).toBe("p4_low");
  });
  it("severidad desconocida cae a medium", () => {
    const { impact, urgency } = severityToImpactUrgency("bogus");
    expect(derivePriority(impact, urgency)).toBe("p3_medium");
  });
});

describe("validateAcknowledge", () => {
  it("permite reconocer solo alertas abiertas", () => {
    expect(validateAcknowledge("open")).toBeNull();
    expect(validateAcknowledge("acknowledged")).toBe(ErrorCode.STATE);
    expect(validateAcknowledge("resolved")).toBe(ErrorCode.STATE);
  });
});

describe("validateResolve", () => {
  it("no permite resolver una alerta ya resuelta", () => {
    expect(validateResolve("open")).toBeNull();
    expect(validateResolve("acknowledged")).toBeNull();
    expect(validateResolve("resolved")).toBe(ErrorCode.STATE);
  });
});

describe("validateCorrelate", () => {
  it("requiere id de caso y alerta no resuelta", () => {
    expect(validateCorrelate("open", "case-1")).toBeNull();
    expect(validateCorrelate("open", "")).toBe(ErrorCode.REQUIRED);
    expect(validateCorrelate("resolved", "case-1")).toBe(ErrorCode.STATE);
  });
});

describe("validateCreateCase", () => {
  it("no crea caso si ya esta correlacionada o resuelta", () => {
    expect(validateCreateCase("open")).toBeNull();
    expect(validateCreateCase("acknowledged")).toBeNull();
    expect(validateCreateCase("correlated")).toBe(ErrorCode.STATE);
    expect(validateCreateCase("resolved")).toBe(ErrorCode.STATE);
  });
});

function tuple(iu: { impact: "critical" | "high" | "medium" | "low"; urgency: "critical" | "high" | "medium" | "low" }): ["critical" | "high" | "medium" | "low", "critical" | "high" | "medium" | "low"] {
  return [iu.impact, iu.urgency];
}
