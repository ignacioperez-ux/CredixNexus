import { describe, it, expect } from "vitest";
import { validateArticleType, helpfulPct, deflectionRate, articleHealth } from "./validation";
import { ErrorCode } from "@/lib/validation";

describe("validateArticleType", () => {
  it("acepta tipos validos y rechaza otros", () => {
    expect(validateArticleType("runbook")).toBeNull();
    expect(validateArticleType("known_error")).toBeNull();
    expect(validateArticleType("blog")).toBe(ErrorCode.FORMAT);
  });
});

describe("helpfulPct", () => {
  it("calcula el porcentaje util", () => {
    expect(helpfulPct(7, 3)).toBe(70);
    expect(helpfulPct(1, 0)).toBe(100);
  });
  it("null si no hay votos", () => {
    expect(helpfulPct(0, 0)).toBeNull();
  });
});

describe("deflectionRate", () => {
  it("evitados sobre evitados+escalados", () => {
    expect(deflectionRate(8, 2)).toBe(80);
    expect(deflectionRate(0, 5)).toBe(0);
    expect(deflectionRate(0, 0)).toBeNull();
  });
});

describe("articleHealth", () => {
  it("clasifica por umbral de utilidad", () => {
    expect(articleHealth(0, 0)).toBe("unrated");
    expect(articleHealth(8, 2)).toBe("good");   // 80%
    expect(articleHealth(5, 5)).toBe("mixed");  // 50%
    expect(articleHealth(2, 8)).toBe("poor");   // 20%
    expect(articleHealth(7, 3)).toBe("good");   // 70% (borde)
    expect(articleHealth(4, 6)).toBe("mixed");  // 40% (borde)
  });
});
