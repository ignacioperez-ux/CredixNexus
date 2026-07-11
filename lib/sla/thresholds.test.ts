import { describe, it, expect } from "vitest";
import { elapsedPct, riskBucket, worstBucket, atRisk } from "./thresholds";

const OPEN = "2026-07-10T00:00:00.000Z";
const DUE = "2026-07-10T10:00:00.000Z"; // 10h de ventana

describe("elapsedPct", () => {
  const now = (h: number) => new Date(`2026-07-10T${String(h).padStart(2, "0")}:00:00.000Z`).getTime();
  it("calcula el % transcurrido", () => {
    expect(elapsedPct(OPEN, DUE, null, now(5))).toBe(50);
    expect(elapsedPct(OPEN, DUE, null, now(9))).toBe(90);
    expect(elapsedPct(OPEN, DUE, null, now(10))).toBe(100);
  });
  it("supera 100% cuando esta vencido", () => {
    expect(elapsedPct(OPEN, DUE, null, now(13))).toBe(130);
  });
  it("null si no hay vencimiento definido", () => {
    expect(elapsedPct(OPEN, null, null, now(5))).toBeNull();
  });
  it("null si el reloj esta detenido (respondido/resuelto)", () => {
    expect(elapsedPct(OPEN, DUE, "2026-07-10T03:00:00.000Z", now(9))).toBeNull();
  });
  it("no devuelve negativos antes de abrir", () => {
    expect(elapsedPct(OPEN, DUE, null, new Date("2026-07-09T20:00:00.000Z").getTime())).toBe(0);
  });
});

describe("riskBucket", () => {
  it("clasifica por umbrales 75/90/100", () => {
    expect(riskBucket(null)).toBe("na");
    expect(riskBucket(50)).toBe("ok");
    expect(riskBucket(75)).toBe("warning");
    expect(riskBucket(89)).toBe("warning");
    expect(riskBucket(90)).toBe("critical");
    expect(riskBucket(99)).toBe("critical");
    expect(riskBucket(100)).toBe("breached");
    expect(riskBucket(250)).toBe("breached");
  });
});

describe("worstBucket / atRisk", () => {
  it("toma el peor de dos relojes", () => {
    expect(worstBucket("ok", "critical")).toBe("critical");
    expect(worstBucket("breached", "warning")).toBe("breached");
    expect(worstBucket("na", "ok")).toBe("ok");
  });
  it("marca en riesgo desde aviso", () => {
    expect(atRisk("ok")).toBe(false);
    expect(atRisk("na")).toBe(false);
    expect(atRisk("warning")).toBe(true);
    expect(atRisk("breached")).toBe(true);
  });
});
