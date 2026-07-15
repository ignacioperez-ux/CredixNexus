import { describe, it, expect } from "vitest";
import { portfolioRoi, squadLoads, wsjfParts, isOpenProject, tribeLoads } from "./portfolio";
import type { PortfolioRow, SquadCapacity } from "./queries";

function row(p: Partial<PortfolioRow>): PortfolioRow {
  return {
    id: p.id ?? "p", project_code: "PRJ-1", name: "x", status: p.status ?? "active", wsjf: p.wsjf ?? 1,
    business_value: p.business_value ?? 5, time_criticality: p.time_criticality ?? 5, risk_reduction: p.risk_reduction ?? 5, job_size: p.job_size ?? 5,
    estimated_benefit_amount: p.estimated_benefit_amount ?? 0, estimated_cost_amount: p.estimated_cost_amount ?? 0,
    actual_benefit_amount: p.actual_benefit_amount ?? null, actual_cost_amount: p.actual_cost_amount ?? null,
    planned_start: null, planned_end: null, actual_start: null, actual_end: null,
    squad: p.squad ?? null, business_unit: null,
  };
}

describe("portfolioRoi", () => {
  it("suma estimado de todos y real solo de los que tienen ambos actuals", () => {
    const rows = [
      row({ estimated_benefit_amount: 200, estimated_cost_amount: 100, actual_benefit_amount: 150, actual_cost_amount: 100 }),
      row({ estimated_benefit_amount: 300, estimated_cost_amount: 100 }), // sin actuals
    ];
    const r = portfolioRoi(rows);
    expect(r.estBenefit).toBe(500);
    expect(r.estCost).toBe(200);
    expect(r.estRoi).toBe(150); // (500-200)/200
    expect(r.realBenefit).toBe(150);
    expect(r.realRoi).toBe(50); // (150-100)/100
    expect(r.measured).toBe(1);
    expect(r.total).toBe(2);
  });
  it("realRoi es null si ningun proyecto tiene actuals", () => {
    expect(portfolioRoi([row({ estimated_cost_amount: 100 })]).realRoi).toBeNull();
  });
});

describe("squadLoads", () => {
  const squads: SquadCapacity[] = [{ id: "s1", name: "Alfa", capacity_points: 10, tribe_id: "t1" }, { id: "s2", name: "Beta", capacity_points: 0, tribe_id: null }];
  it("suma job_size comprometido (solo estados abiertos) por squad y calcula carga %", () => {
    const rows = [
      row({ squad: { id: "s1", name: "Alfa" }, job_size: 6, status: "active" }),
      row({ squad: { id: "s1", name: "Alfa" }, job_size: 8, status: "proposed" }),
      row({ squad: { id: "s1", name: "Alfa" }, job_size: 5, status: "completed" }), // cerrado -> no cuenta
    ];
    const [alfa] = squadLoads(squads, rows);
    expect(alfa.id).toBe("s1");
    expect(alfa.committed).toBe(14);
    expect(alfa.projects).toBe(2);
    expect(alfa.loadPct).toBe(140);
    expect(alfa.over).toBe(true);
  });
  it("capacidad 0 -> loadPct null (no divide por cero)", () => {
    const loads = squadLoads(squads, []);
    expect(loads.find((l) => l.id === "s2")?.loadPct).toBeNull();
  });
});

describe("wsjfParts", () => {
  it("numerador = suma de los tres; wsjf = numerador / job_size", () => {
    expect(wsjfParts({ business_value: 8, time_criticality: 5, risk_reduction: 2, job_size: 3 })).toEqual({ numerator: 15, jobSize: 3, wsjf: 5 });
  });
  it("job_size < 1 se acota a 1", () => {
    expect(wsjfParts({ business_value: 4, time_criticality: 0, risk_reduction: 0, job_size: 0 }).jobSize).toBe(1);
  });
});

describe("tribeLoads", () => {
  const tribes = [{ id: "t1", name: "Core", code: "CORE" }];
  const squads: SquadCapacity[] = [
    { id: "s1", name: "Ledger", capacity_points: 8, tribe_id: "t1" },
    { id: "s2", name: "Prisma", capacity_points: 6, tribe_id: "t1" },
    { id: "s3", name: "Fuera", capacity_points: 5, tribe_id: null },
  ];
  it("agrega capacidad/demanda/iniciativas de los squads de la tribu (solo abiertos)", () => {
    const rows = [
      row({ squad: { id: "s1", name: "Ledger" }, job_size: 5, wsjf: 4, status: "active" }),
      row({ squad: { id: "s2", name: "Prisma" }, job_size: 4, wsjf: 2, status: "proposed" }),
      row({ squad: { id: "s3", name: "Fuera" }, job_size: 9, status: "active" }), // otra tribu
      row({ squad: { id: "s1", name: "Ledger" }, job_size: 3, status: "completed" }), // cerrado
    ];
    const [core] = tribeLoads(tribes, squads, rows);
    expect(core.capacity).toBe(14);       // 8 + 6
    expect(core.committed).toBe(9);       // 5 + 4 (cerrado no cuenta)
    expect(core.projects).toBe(2);
    expect(core.squads).toBe(2);
    expect(core.loadPct).toBe(64);        // 9/14
    expect(core.avgWsjf).toBe(3);         // (4+2)/2
    expect(core.squadIds.sort()).toEqual(["s1", "s2"]);
  });
});

describe("isOpenProject", () => {
  it("abiertos consumen capacidad; cerrados no", () => {
    expect(isOpenProject("active")).toBe(true);
    expect(isOpenProject("proposed")).toBe(true);
    expect(isOpenProject("completed")).toBe(false);
    expect(isOpenProject("cancelled")).toBe(false);
  });
});
