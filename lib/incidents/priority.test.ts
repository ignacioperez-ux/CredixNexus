import { describe, it, expect } from "vitest";
import { derivePriority, type Impact, type Urgency, type Priority } from "./priority";

// Matriz ITIL esperada (debe coincidir con public.derive_priority en sql/0014).
// Regla: prioridad por el mayor nivel entre impacto y urgencia.
const EXPECTED: Record<Impact, Record<Urgency, Priority>> = {
  critical: { critical: "p1_critical", high: "p1_critical", medium: "p1_critical", low: "p1_critical" },
  high: { critical: "p1_critical", high: "p2_high", medium: "p2_high", low: "p2_high" },
  medium: { critical: "p1_critical", high: "p2_high", medium: "p3_medium", low: "p3_medium" },
  low: { critical: "p1_critical", high: "p2_high", medium: "p3_medium", low: "p4_low" },
};

describe("derivePriority (matriz ITIL impacto x urgencia)", () => {
  const levels: (Impact | Urgency)[] = ["critical", "high", "medium", "low"];
  for (const impact of levels) {
    for (const urgency of levels) {
      it(`${impact} x ${urgency} -> ${EXPECTED[impact as Impact][urgency as Urgency]}`, () => {
        expect(derivePriority(impact as Impact, urgency as Urgency)).toBe(EXPECTED[impact as Impact][urgency as Urgency]);
      });
    }
  }
});
