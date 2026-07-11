import { describe, it, expect } from "vitest";
import { buildGraph, pathExists, wouldCreateCycle, type ServiceInput, type EdgeInput, type CiInput, type IncidentInput, type ProductInput } from "./graph";

const services: ServiceInput[] = [
  { id: "pagos", code: "PAGOS", name: "Pagos", business_domain: "pagos", criticality: "critical" },
  { id: "concil", code: "CONCIL", name: "Conciliacion", business_domain: "conciliacion", criticality: "high" },
  { id: "auth", code: "AUTH", name: "Autenticacion", business_domain: "seguridad", criticality: "critical" },
];
const cis: CiInput[] = [
  { id: "vpos", name: "VPOS", ci_type: "application", service_id: "pagos" },   // declarado
  { id: "sac", name: "SAC App", ci_type: "application", service_id: null },     // se derivara
];
const products: ProductInput[] = [{ id: "tc", name: "Tarjeta de Credito" }];
const incidents: IncidentInput[] = [
  { id: "i1", incident_number: "INC-1", title: "Pago fallido", status: "in_progress", priority: "p1_critical", affected_service_id: "pagos", affected_ci_id: "sac", affected_product_id: "tc" },
  { id: "i2", incident_number: "INC-2", title: "Resuelto viejo", status: "resolved", priority: "p3_medium", affected_service_id: "pagos", affected_ci_id: null, affected_product_id: null },
];
const edges: EdgeInput[] = [
  { id: "e1", service_id: "pagos", depends_on_service_id: "auth", dependency_type: "sync", criticality: "high" },
];

describe("buildGraph", () => {
  const nodes = buildGraph(services, edges, cis, incidents, products);
  const pagos = nodes.find((n) => n.id === "pagos")!;

  it("asocia CIs declarados y derivados de casos", () => {
    const ids = pagos.cis.map((c) => c.id).sort();
    expect(ids).toEqual(["sac", "vpos"]); // vpos por service_id, sac por co-ocurrencia
  });
  it("deriva productos impactados de la co-ocurrencia", () => {
    expect(pagos.products.map((p) => p.name)).toEqual(["Tarjeta de Credito"]);
  });
  it("lista solo casos ACTIVOS y cuenta correctamente", () => {
    expect(pagos.activeIncidents).toBe(1);
    expect(pagos.incidents[0].incident_number).toBe("INC-1");
  });
  it("resuelve dependsOn y dependedOnBy", () => {
    expect(pagos.dependsOn.map((d) => d.name)).toEqual(["Autenticacion"]);
    const auth = nodes.find((n) => n.id === "auth")!;
    expect(auth.dependedOnBy.map((d) => d.name)).toEqual(["Pagos"]);
  });
});

describe("pathExists / wouldCreateCycle", () => {
  const e = [
    { service_id: "a", depends_on_service_id: "b" },
    { service_id: "b", depends_on_service_id: "c" },
  ];
  it("detecta caminos transitivos", () => {
    expect(pathExists(e, "a", "c")).toBe(true);
    expect(pathExists(e, "c", "a")).toBe(false);
  });
  it("rechaza auto-dependencia", () => {
    expect(wouldCreateCycle(e, "a", "a")).toBe(true);
  });
  it("detecta ciclo transitivo (c depende de a cerraria el lazo)", () => {
    expect(wouldCreateCycle(e, "c", "a")).toBe(true);  // c->a, pero a->b->c ya existe
  });
  it("permite arista que no crea ciclo", () => {
    expect(wouldCreateCycle(e, "a", "c")).toBe(false); // a ya alcanza c; a->c no cierra lazo hacia a
  });
});
