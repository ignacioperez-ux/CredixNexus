import { describe, it, expect } from "vitest";
import {
  fraudNextStates, disputeNextStates, validateFraudTransition, validateDisputeTransition,
  validateFraudOpen, validateDisputeOpen, validateRecovery, maskName,
} from "./validation";
import { ErrorCode } from "@/lib/validation";

describe("maquina de estados fraude", () => {
  it("transiciones validas segun el estado", () => {
    expect(fraudNextStates("reported")).toEqual(["investigating", "false_positive"]);
    expect(validateFraudTransition("investigating", "confirmed")).toBeNull();
    expect(validateFraudTransition("confirmed", "recovered")).toBeNull();
  });
  it("rechaza transicion invalida o desde estado terminal", () => {
    expect(validateFraudTransition("reported", "recovered")).toBe(ErrorCode.STATE);
    expect(validateFraudTransition("closed", "investigating")).toBe(ErrorCode.STATE);
    expect(fraudNextStates("closed")).toEqual([]);
  });
});

describe("maquina de estados disputa", () => {
  it("flujo submitted -> won/lost -> closed", () => {
    expect(disputeNextStates("submitted")).toEqual(["won", "lost"]);
    expect(validateDisputeTransition("submitted", "won")).toBeNull();
    expect(validateDisputeTransition("won", "closed")).toBeNull();
  });
  it("rechaza saltos invalidos", () => {
    expect(validateDisputeTransition("opened", "won")).toBe(ErrorCode.STATE);
    expect(validateDisputeTransition("cancelled", "opened")).toBe(ErrorCode.STATE);
  });
});

describe("validacion de apertura", () => {
  it("fraude: tipo/fuente validos, riesgo 0-100, monto >=0", () => {
    expect(validateFraudOpen({ fraudType: "phishing", detectionSource: "manual_review" })).toBeNull();
    expect(validateFraudOpen({ fraudType: "x", detectionSource: "manual_review" })).toBe(ErrorCode.FORMAT);
    expect(validateFraudOpen({ fraudType: "phishing", detectionSource: "manual_review", riskScore: 120 })).toBe(ErrorCode.FORMAT);
    expect(validateFraudOpen({ fraudType: "phishing", detectionSource: "manual_review", amountExposed: -1 })).toBe(ErrorCode.FORMAT);
  });
  it("disputa: tipo valido, monto >=0", () => {
    expect(validateDisputeOpen({ disputeType: "duplicate_charge", disputedAmount: 1000 })).toBeNull();
    expect(validateDisputeOpen({ disputeType: "nope" })).toBe(ErrorCode.FORMAT);
    expect(validateDisputeOpen({ disputeType: "other", disputedAmount: -5 })).toBe(ErrorCode.FORMAT);
  });
});

describe("validateRecovery", () => {
  it("no permite negativo ni exceder el techo", () => {
    expect(validateRecovery(100, 500)).toBeNull();
    expect(validateRecovery(600, 500)).toBe(ErrorCode.FORMAT);
    expect(validateRecovery(-1, null)).toBe(ErrorCode.FORMAT);
    expect(validateRecovery(1000, null)).toBeNull();
  });
});

describe("maskName (PII)", () => {
  it("enmascara dejando iniciales", () => {
    expect(maskName("Juan Perez")).toBe("J••• P••••");
    expect(maskName(null)).toBe("—");
  });
});
