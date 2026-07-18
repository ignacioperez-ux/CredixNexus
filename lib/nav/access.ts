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
  { prefix: "/operaciones", perm: "incident.read" },
  { prefix: "/mi-trabajo", perm: "project.read" },
  { prefix: "/mi-squad", perm: "squad.read" },
  { prefix: "/mis-iniciativas", perm: "project.read" },
  { prefix: "/mi-perfil", perm: "project.read" },
  { prefix: "/mi-dia", perm: "incident.read" },
  { prefix: "/mis-casos", perm: "incident.read" },
  { prefix: "/cola-equipo", perm: "incident.read" },
  { prefix: "/mi-desempeno", perm: "incident.read" },
  { prefix: "/incidents", perm: "incident.read" },
  { prefix: "/triage", perm: "triage.manage" },
  { prefix: "/sla-governance", perm: "sla.read" },
  { prefix: "/customers", perm: "incident.read" },
  { prefix: "/analytics", perm: ["incident.read", "analytics.read"] },
  { prefix: "/ai-center", perm: ["incident.read", "ai.read"] },
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
  { prefix: "/knowledge/revision", perm: "knowledge.manage" },
  { prefix: "/rules", perm: "rule.read" },
  { prefix: "/workflows", perm: "workflow.read" },
  { prefix: "/projects", perm: "project.read" },
  { prefix: "/casos-convertidos", perm: ["project.read", "incident.read"] },
  { prefix: "/evolucion/mapa", perm: "squad.read" },
  { prefix: "/evolucion", perm: "project.read" },
  { prefix: "/squads", perm: "squad.read" },
  { prefix: "/talent", perm: "talent.read" },
  { prefix: "/workload", perm: "squad.read" },
  { prefix: "/processes", perm: "process.read" },
  { prefix: "/delivery-areas", perm: "area.read" },
  { prefix: "/ledger", perm: "audit.read" },
  { prefix: "/catalog", perm: "masterdata.manage" },
  { prefix: "/admin", perm: "user.manage" },
];

/** Permiso requerido para una ruta (por prefijo mas especifico), o undefined si es libre. */
export function requiredPermForPath(pathname: string): string | string[] | undefined {
  const matches = ROUTE_PERMISSIONS.filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (matches.length === 0) return undefined;
  // el prefijo mas largo gana (mas especifico)
  return matches.sort((a, b) => b.prefix.length - a.prefix.length)[0].perm;
}

// Denylist de ruta POR PERSONA (segregacion de capa de aplicacion, §0 Operaciones). El perm de
// ruta NO alcanza para segregar cuando el rol conserva permisos amplios: el Gerente de Operaciones
// (support_lead) tiene project.read / squad.read / area.read (los usa para "Casos en Evolucion",
// Workload y catalogos), asi que por perm solo podria entrar a /projects o /squads. Aqui se bloquea
// por rol el acceso a los modulos de Evolucion/definicion aunque tenga el permiso. Coherente con su
// menu (OPERATIONS_NAV): lo que no esta en su persona, no se alcanza por URL. NO toca RLS ni perms.
export const ROLE_ROUTE_DENY: Record<string, string[]> = {
  support_lead: ["/projects", "/squads", "/evolucion", "/delivery-areas", "/rules", "/ai-center"],
  // Miembro de Squad: conserva project.read/squad.read (para sus vistas /mi-*), pero NO alcanza el
  // portafolio global, la Torre/Mapa de Evolucion, el listado global de Squads, el Workload global,
  // los casos convertidos ni el motor de reglas/AI. Usa las rutas /mi-* acotadas.
  squad_member: ["/projects", "/squads", "/workload", "/evolucion", "/casos-convertidos", "/rules", "/ai-center"],
  // Operador: solo su dia / sus casos / cola (RO) / crear caso / KB / desempeno / notificaciones.
  // Toda ruta de GESTION responde 403 aunque tenga el perm de lectura (nav + guard). NO se deniega
  // /incidents (necesita el detalle de su caso), /portal, /service-catalog (solicitante), /knowledge.
  support_agent: [
    "/dashboard", "/workspace", "/triage", "/operaciones", "/sla-governance", "/customers",
    "/fraud-disputes", "/risk", "/major-incidents", "/problems", "/changes", "/observability",
    "/dependencies", "/cmdb", "/vendors", "/rules", "/workflows", "/ai-center", "/projects",
    "/squads", "/workload", "/talent", "/delivery-areas", "/evolucion", "/casos-convertidos",
    "/analytics", "/admin", "/catalog", "/ledger", "/processes",
  ],
};

// Personas internas con experiencia/segregacion dedicada. La segregacion de persona (overlay de nav
// EN navigation.ts + denylist de ruta AQUI) aplica SOLO cuando el usuario es de UNA sola persona
// interna. Un multi-persona (2+) es un power-user: NO se restringe por persona; su acceso lo gobiernan
// `perm` por item/ruta + RLS + la regla de oro backend (incident-authz). navForRoles usa el MISMO
// criterio (solePersona) para el overlay -> ambas capas coherentes.
export const INTERNAL_PERSONA_ROLES = ["support_lead", "support_agent", "product_owner", "squad_member"];

/** La unica persona interna del usuario, o null si tiene 0 o 2+ (multi-persona / power-user). */
export function solePersona(roles: string[]): string | null {
  const p = INTERNAL_PERSONA_ROLES.filter((r) => roles.includes(r));
  return p.length === 1 ? p[0] : null;
}

/** true si la ruta esta vedada para la persona del usuario (denylist de persona). Solo aplica a un
 *  usuario de UNA sola persona interna; un multi-persona no se restringe por persona. Admin nunca se
 *  ve afectado (se evalua fuera, con isAdmin). */
export function isRouteDeniedForRoles(pathname: string, roles: string[]): boolean {
  const persona = solePersona(roles);
  if (!persona) return false;
  for (const prefix of ROLE_ROUTE_DENY[persona] ?? []) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return true;
  }
  return false;
}

// Nota: el "cockpit" por rol (que categorias se auto-expanden) vive ahora en lib/nav/role-ux.ts
// (ROLE_UX / emphasisForRoles), fuente unica de la experiencia por rol. `perm` sigue siendo el
// candado de visibilidad.

/** Home por rol: a donde cae el usuario al ingresar segun su acceso real. */
export function defaultHome(perms: string[], isAdmin: boolean): string {
  if (isAdmin) return "/dashboard";
  if (perms.includes("incident.read")) return "/workspace";                 // agente / operaciones
  if (perms.includes("project.read") || perms.includes("squad.read")) return "/projects"; // evolucion / squad
  return "/portal";                                                          // usuario final / autoservicio
}
