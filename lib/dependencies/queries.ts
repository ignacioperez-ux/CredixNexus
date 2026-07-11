import type { SupabaseClient } from "@supabase/supabase-js";
import { buildGraph, type ServiceNode, type ServiceInput, type EdgeInput, type CiInput, type IncidentInput, type ProductInput } from "@/lib/dependencies/graph";

// Capa de datos del grafo de dependencias. RLS aisla por tenant. Todo se arma sobre
// datos REALES: servicios, aristas declaradas (service_dependency), CIs (CMDB) e incidentes.

export type { ServiceNode } from "@/lib/dependencies/graph";
export type ServiceOption = { id: string; name: string; business_domain: string };
export type DependencyGraph = { nodes: ServiceNode[]; services: ServiceOption[] };

export async function getDependencyGraph(supabase: SupabaseClient): Promise<DependencyGraph> {
  const [svc, edg, ci, inc, prod] = await Promise.all([
    supabase.from("service").select("id, code, name, business_domain, criticality").eq("status", "active").order("name"),
    supabase.from("service_dependency").select("id, service_id, depends_on_service_id, dependency_type, criticality"),
    supabase.from("configuration_item").select("id, name, ci_type, service_id").neq("status", "deleted"),
    supabase.from("incident").select("id, incident_number, title, status, priority, affected_service_id, affected_ci_id, affected_product_id"),
    supabase.from("product").select("id, name"),
  ]);
  for (const r of [svc, edg, ci, inc, prod]) if (r.error) throw new Error(r.error.message);

  const services = (svc.data ?? []) as ServiceInput[];
  const edges = (edg.data ?? []) as EdgeInput[];
  const cis = (ci.data ?? []) as CiInput[];
  const incidents = (inc.data ?? []) as IncidentInput[];
  const products = (prod.data ?? []) as ProductInput[];

  const nodes = buildGraph(services, edges, cis, incidents, products);
  return {
    nodes,
    services: services.map((s) => ({ id: s.id, name: s.name, business_domain: s.business_domain })),
  };
}

/** Aristas actuales (para validacion de ciclos en la accion). */
export async function getDependencyEdges(supabase: SupabaseClient): Promise<{ service_id: string; depends_on_service_id: string }[]> {
  const { data, error } = await supabase.from("service_dependency").select("service_id, depends_on_service_id");
  if (error) throw new Error(error.message);
  return (data ?? []) as { service_id: string; depends_on_service_id: string }[];
}
