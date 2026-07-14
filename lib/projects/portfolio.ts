import { computeRoi, type PortfolioRow, type SquadCapacity } from "./queries";

// Logica pura del portafolio (Fase Evolucion 1.4). Testeable, sin IO. El dato real llega
// por listPortfolio / listSquadCapacity.

// Estados que consumen capacidad (trabajo comprometido, aun no cerrado).
export const OPEN_PROJECT_STATUSES = ["proposed", "approved", "on_hold", "active"] as const;
export const ACTIVE_PROJECT_STATUSES = ["active"] as const;

export function isOpenProject(status: string): boolean {
  return (OPEN_PROJECT_STATUSES as readonly string[]).includes(status);
}

/** ROI agregado del portafolio: estimado (todos) y real (solo proyectos con ambos actuals). */
export type PortfolioRoi = {
  estBenefit: number; estCost: number; estRoi: number | null;
  realBenefit: number; realCost: number; realRoi: number | null; measured: number; total: number;
};

export function portfolioRoi(rows: PortfolioRow[]): PortfolioRoi {
  let estBenefit = 0, estCost = 0, realBenefit = 0, realCost = 0, measured = 0;
  for (const r of rows) {
    estBenefit += Number(r.estimated_benefit_amount ?? 0);
    estCost += Number(r.estimated_cost_amount ?? 0);
    if (r.actual_benefit_amount != null && r.actual_cost_amount != null) {
      realBenefit += Number(r.actual_benefit_amount);
      realCost += Number(r.actual_cost_amount);
      measured++;
    }
  }
  return {
    estBenefit, estCost, estRoi: computeRoi(estBenefit, estCost),
    realBenefit, realCost, realRoi: measured > 0 ? computeRoi(realBenefit, realCost) : null,
    measured, total: rows.length,
  };
}

/** Carga prospectiva por squad: demanda (job_size comprometido) vs capacidad (puntos). */
export type SquadLoad = {
  id: string; name: string; capacity: number; committed: number; projects: number;
  loadPct: number | null; over: boolean;
};

export function squadLoads(squads: SquadCapacity[], rows: PortfolioRow[]): SquadLoad[] {
  const demand = new Map<string, { pts: number; count: number }>();
  for (const r of rows) {
    if (!r.squad?.id || !isOpenProject(r.status)) continue;
    const d = demand.get(r.squad.id) ?? { pts: 0, count: 0 };
    d.pts += Number(r.job_size ?? 0);
    d.count += 1;
    demand.set(r.squad.id, d);
  }
  return squads.map((s) => {
    const d = demand.get(s.id) ?? { pts: 0, count: 0 };
    const loadPct = s.capacity_points > 0 ? Math.round((d.pts / s.capacity_points) * 100) : null;
    return { id: s.id, name: s.name, capacity: s.capacity_points, committed: d.pts, projects: d.count, loadPct, over: loadPct != null && loadPct > 100 };
  }).sort((a, b) => (b.loadPct ?? -1) - (a.loadPct ?? -1));
}

/** Componentes WSJF (numerador = valor + criticidad + reduccion de riesgo; denominador = tamano). */
export function wsjfParts(r: Pick<PortfolioRow, "business_value" | "time_criticality" | "risk_reduction" | "job_size">) {
  const numerator = Number(r.business_value ?? 0) + Number(r.time_criticality ?? 0) + Number(r.risk_reduction ?? 0);
  const jobSize = Math.max(1, Number(r.job_size ?? 1));
  return { numerator, jobSize, wsjf: Math.round((numerator / jobSize) * 10) / 10 };
}
