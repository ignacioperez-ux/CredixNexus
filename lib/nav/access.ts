// Visibilidad por permiso (navegacion, guards de ruta y home por rol). Puro y testeable.
// Regla: admin ve todo; sin permiso requerido = visible; si no, requiere el/los permiso(s).

export function canSeeNav(perm: string | string[] | undefined, perms: string[], isAdmin: boolean): boolean {
  if (isAdmin || !perm) return true;
  return Array.isArray(perm) ? perm.some((p) => perms.includes(p)) : perms.includes(perm);
}

// Mapa ruta -> permiso requerido (espeja los permisos del sidebar). Fuente unica de verdad
// para el guard de ruta del layout. Rutas sin entrada = accesibles a cualquier autenticado.
export const ROUTE_PERMISSIONS: { prefix: string; perm: string | string[] }[] = [
  { prefix: "/workspace", perm: "incident.read" },
  { prefix: "/incidents", perm: "incident.read" },
  { prefix: "/triage", perm: "triage.manage" },
  { prefix: "/sla-governance", perm: "sla.read" },
  { prefix: "/customers", perm: "incident.read" },
  { prefix: "/analytics", perm: "incident.read" },
  { prefix: "/ai-center", perm: "incident.read" },
  { prefix: "/fraud-disputes", perm: ["fraud.read", "dispute.read"] },
  { prefix: "/risk", perm: "risk.read" },
  { prefix: "/service-catalog", perm: "service_catalog.read" },
  { prefix: "/major-incidents", perm: "major_incident.read" },
  { prefix: "/problems", perm: "problem.read" },
  { prefix: "/changes", perm: "change.read" },
  { prefix: "/observability", perm: "observability.read" },
  { prefix: "/dependencies", perm: "cmdb.read" },
  { prefix: "/cmdb", perm: "cmdb.read" },
  { prefix: "/vendors", perm: "vendor.read" },
  { prefix: "/knowledge", perm: "knowledge.read" },
  { prefix: "/rules", perm: "rule.read" },
  { prefix: "/workflows", perm: "workflow.read" },
  { prefix: "/projects", perm: "project.read" },
  { prefix: "/squads", perm: "squad.read" },
  { prefix: "/talent", perm: "talent.read" },
  { prefix: "/workload", perm: "squad.read" },
  { prefix: "/processes", perm: "process.read" },
  { prefix: "/delivery-areas", perm: "area.read" },
  { prefix: "/ledger", perm: "audit.read" },
  { prefix: "/catalog", perm: "masterdata.manage" },
];

/** Permiso requerido para una ruta (por prefijo mas especifico), o undefined si es libre. */
export function requiredPermForPath(pathname: string): string | string[] | undefined {
  const matches = ROUTE_PERMISSIONS.filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (matches.length === 0) return undefined;
  // el prefijo mas largo gana (mas especifico)
  return matches.sort((a, b) => b.prefix.length - a.prefix.length)[0].perm;
}

/** Home por rol: a donde cae el usuario al ingresar segun su acceso real. */
export function defaultHome(perms: string[], isAdmin: boolean): string {
  if (isAdmin) return "/dashboard";
  if (perms.includes("incident.read")) return "/workspace";                 // agente / operaciones
  if (perms.includes("project.read") || perms.includes("squad.read")) return "/projects"; // evolucion / squad
  return "/portal";                                                          // usuario final / autoservicio
}
