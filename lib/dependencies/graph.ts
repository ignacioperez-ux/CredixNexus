// Grafo de dependencias — agregacion PURA (testeable, sin red).
// Combina topologia declarada (service_dependency, configuration_item.service_id) con
// asociaciones DERIVADAS de evidencia real (co-ocurrencia en incidentes). Cero invento.

export const ACTIVE_INCIDENT_STATUSES = ["new", "triaged", "assigned", "in_progress", "waiting", "reopened", "in_evolution"];

export type ServiceInput = { id: string; code: string; name: string; business_domain: string; criticality: string };
export type EdgeInput = { id: string; service_id: string; depends_on_service_id: string; dependency_type: string; criticality: string };
export type CiInput = { id: string; name: string; ci_type: string; service_id: string | null };
export type ProductInput = { id: string; name: string };
export type IncidentInput = {
  id: string; incident_number: string; title: string; status: string; priority: string;
  affected_service_id: string | null; affected_ci_id: string | null; affected_product_id: string | null;
};

export type Ref = { id: string; name: string };
export type CiRef = { id: string; name: string; ci_type: string };
export type DepRef = { edgeId: string; id: string; name: string; type: string; criticality: string };
export type IncidentRef = { id: string; incident_number: string; title: string; status: string; priority: string; via: "service" | "ci" };

export type ServiceNode = {
  id: string; code: string; name: string; domain: string; criticality: string;
  cis: CiRef[]; products: Ref[]; dependsOn: DepRef[]; dependedOnBy: DepRef[];
  incidents: IncidentRef[]; activeIncidents: number;
};

function isActive(status: string): boolean {
  return ACTIVE_INCIDENT_STATUSES.includes(status);
}

/** Construye los nodos del grafo con impacto (blast radius) por servicio. */
export function buildGraph(
  services: ServiceInput[], edges: EdgeInput[], cis: CiInput[], incidents: IncidentInput[], products: ProductInput[],
): ServiceNode[] {
  const ciMap = new Map(cis.map((c) => [c.id, c]));
  const productMap = new Map(products.map((p) => [p.id, p]));
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  return services
    .map((s) => {
      // CIs asociados: declarados (service_id) + derivados de incidentes del servicio.
      const ciIds = new Set<string>();
      for (const c of cis) if (c.service_id === s.id) ciIds.add(c.id);
      for (const i of incidents) if (i.affected_service_id === s.id && i.affected_ci_id) ciIds.add(i.affected_ci_id);
      const cisResolved: CiRef[] = [...ciIds]
        .map((id) => ciMap.get(id))
        .filter((c): c is CiInput => !!c)
        .map((c) => ({ id: c.id, name: c.name, ci_type: c.ci_type }));

      // Productos impactados: derivados de la co-ocurrencia en incidentes del servicio.
      const prodIds = new Set<string>();
      for (const i of incidents) if (i.affected_service_id === s.id && i.affected_product_id) prodIds.add(i.affected_product_id);
      const productsResolved: Ref[] = [...prodIds]
        .map((id) => productMap.get(id))
        .filter((p): p is ProductInput => !!p)
        .map((p) => ({ id: p.id, name: p.name }));

      // Incidentes activos que tocan el servicio (directo) o alguno de sus CIs.
      const incidentRefs: IncidentRef[] = [];
      for (const i of incidents) {
        if (!isActive(i.status)) continue;
        const viaService = i.affected_service_id === s.id;
        const viaCi = !!i.affected_ci_id && ciIds.has(i.affected_ci_id);
        if (viaService || viaCi) {
          incidentRefs.push({ id: i.id, incident_number: i.incident_number, title: i.title, status: i.status, priority: i.priority, via: viaService ? "service" : "ci" });
        }
      }

      const dependsOn: DepRef[] = edges
        .filter((e) => e.service_id === s.id)
        .map((e) => ({ edgeId: e.id, id: e.depends_on_service_id, name: serviceMap.get(e.depends_on_service_id)?.name ?? "—", type: e.dependency_type, criticality: e.criticality }));
      const dependedOnBy: DepRef[] = edges
        .filter((e) => e.depends_on_service_id === s.id)
        .map((e) => ({ edgeId: e.id, id: e.service_id, name: serviceMap.get(e.service_id)?.name ?? "—", type: e.dependency_type, criticality: e.criticality }));

      return {
        id: s.id, code: s.code, name: s.name, domain: s.business_domain, criticality: s.criticality,
        cis: cisResolved, products: productsResolved, dependsOn, dependedOnBy,
        incidents: incidentRefs, activeIncidents: incidentRefs.length,
      };
    })
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));
}

/** ¿Existe camino de `from` a `to` siguiendo aristas depends-on? (DFS) */
export function pathExists(edges: { service_id: string; depends_on_service_id: string }[], from: string, to: string): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.service_id) ?? [];
    list.push(e.depends_on_service_id);
    adj.set(e.service_id, list);
  }
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const n = stack.pop() as string;
    if (n === to) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const m of adj.get(n) ?? []) stack.push(m);
  }
  return false;
}

/** Agregar service_id -> depends_on_service_id crea ciclo si el destino ya alcanza al origen. */
export function wouldCreateCycle(edges: { service_id: string; depends_on_service_id: string }[], serviceId: string, dependsOnId: string): boolean {
  if (serviceId === dependsOnId) return true;
  return pathExists(edges, dependsOnId, serviceId);
}
