// Visibilidad por permiso (navegacion, guards de ruta y home por rol). Puro y testeable.
// Regla: admin ve todo; sin permiso requerido = visible; si no, requiere el/los permiso(s).

export function canSeeNav(perm: string | string[] | undefined, perms: string[], isAdmin: boolean): boolean {
  if (isAdmin || !perm) return true;
  return Array.isArray(perm) ? perm.some((p) => perms.includes(p)) : perms.includes(perm);
}

// Mapa ruta -> permiso requerido (espeja los permisos del sidebar). Fuente unica de verdad
// para el guard de ruta del layout. Rutas sin entrada = accesibles a cualquier autenticado.
export const ROUTE_PERMISSIONS: { prefix: string; perm: string | string[] }[] = [
  { prefix: "/dashboard", perm: "incident.read" },
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

// Perfil de navegacion por rol: el "cockpit" curado de cada rol (sus opciones diarias).
// El permiso sigue siendo el candado de seguridad; esto solo decide que se muestra por defecto
// vs. lo que va a "Mas...". Un rol sin perfil (o admin) ve todo lo permitido como primario.
export const ROLE_PROFILES: Record<string, string[]> = {
  support_agent: ["nav.workspace", "nav.incidents", "nav.triage", "nav.sla", "nav.customers", "nav.knowledge", "nav.servicecatalog"],
  support_lead: ["nav.workspace", "nav.incidents", "nav.triage", "nav.sla", "nav.customers", "nav.analytics", "nav.majorincidents", "nav.problems", "nav.changes", "nav.frauddisputes", "nav.observability", "nav.vendors", "nav.knowledge", "nav.servicecatalog"],
  product_owner: ["nav.analytics", "nav.projects", "nav.squads", "nav.talent", "nav.resources", "nav.rules", "nav.workflows", "nav.aicenter", "nav.knowledge"],
  squad_member: ["nav.projects", "nav.squads", "nav.resources", "nav.knowledge"],
  partner_user: ["nav.selfservice", "nav.knowledge", "nav.servicecatalog"],
  business_owner: ["nav.analytics", "nav.risk", "nav.processes", "nav.projects", "nav.knowledge"],
  grc_officer: ["nav.risk", "nav.ledger", "nav.processes", "nav.observability", "nav.changes", "nav.analytics"],
  change_manager: ["nav.changes", "nav.majorincidents", "nav.problems", "nav.workflows", "nav.dependencies", "nav.knowledge"],
  auditor: ["nav.ledger", "nav.analytics", "nav.processes"],
  people_lead: ["nav.talent", "nav.squads", "nav.resources"],
  responsable_comercial: ["nav.customers", "nav.selfservice", "nav.servicecatalog", "nav.knowledge"],
};

/** Claves de nav primarias (cockpit) para los roles del usuario. null = todo primario
 *  (admin, o rol sin perfil: no ocultamos nada por las dudas). nav.dashboard siempre primario. */
export function primaryNavKeys(roles: string[], isAdmin: boolean): Set<string> | null {
  if (isAdmin) return null;
  const keys = new Set<string>(["nav.dashboard"]);
  let matched = false;
  for (const r of roles) {
    const profile = ROLE_PROFILES[r];
    if (profile) { matched = true; for (const k of profile) keys.add(k); }
  }
  return matched ? keys : null;
}

/** Home por rol: a donde cae el usuario al ingresar segun su acceso real. */
export function defaultHome(perms: string[], isAdmin: boolean): string {
  if (isAdmin) return "/dashboard";
  if (perms.includes("incident.read")) return "/workspace";                 // agente / operaciones
  if (perms.includes("project.read") || perms.includes("squad.read")) return "/projects"; // evolucion / squad
  return "/portal";                                                          // usuario final / autoservicio
}
