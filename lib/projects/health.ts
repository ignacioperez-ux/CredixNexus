import type { ProjectRisk } from "./queries";

// Salud de la iniciativa a partir de sus blockers/riesgos/dependencias abiertos (Iniciativa 360).
// crit: hay un bloqueo o un riesgo critico abierto. warn: riesgo alto o dependencia abierta.
export type Health = "good" | "warn" | "crit";

export function initiativeHealth(risks: Pick<ProjectRisk, "kind" | "severity" | "status">[]): Health {
  const open = risks.filter((r) => r.status !== "resolved");
  if (open.some((r) => r.kind === "blocker" || r.severity === "critical")) return "crit";
  if (open.some((r) => r.severity === "high" || r.kind === "dependency")) return "warn";
  return "good";
}

export function openRiskCount(risks: Pick<ProjectRisk, "status">[]): number {
  return risks.filter((r) => r.status !== "resolved").length;
}
