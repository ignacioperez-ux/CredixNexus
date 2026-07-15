import { describe, it, expect } from "vitest";
import { initiativeHealth, openRiskCount } from "./health";

const r = (kind: "blocker" | "risk" | "dependency", severity: "low" | "medium" | "high" | "critical", status: "open" | "mitigating" | "resolved") => ({ kind, severity, status });

describe("initiativeHealth", () => {
  it("crit si hay bloqueo o riesgo critico abierto", () => {
    expect(initiativeHealth([r("blocker", "medium", "open")])).toBe("crit");
    expect(initiativeHealth([r("risk", "critical", "mitigating")])).toBe("crit");
  });
  it("warn si hay riesgo alto o dependencia abierta (sin bloqueos)", () => {
    expect(initiativeHealth([r("risk", "high", "open")])).toBe("warn");
    expect(initiativeHealth([r("dependency", "medium", "open")])).toBe("warn");
  });
  it("good si todo esta resuelto o es menor", () => {
    expect(initiativeHealth([r("blocker", "critical", "resolved")])).toBe("good");
    expect(initiativeHealth([r("risk", "low", "open")])).toBe("good");
    expect(initiativeHealth([])).toBe("good");
  });
});

describe("openRiskCount", () => {
  it("cuenta los no resueltos", () => {
    expect(openRiskCount([{ status: "open" }, { status: "mitigating" }, { status: "resolved" }])).toBe(2);
  });
});
