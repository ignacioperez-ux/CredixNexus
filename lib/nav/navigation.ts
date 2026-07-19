import type { MessageKey } from "@/lib/i18n/dictionaries";
import { solePersona } from "./access";

// ---------------------------------------------------------------------------
// Navegacion centralizada (Estructura Macro Aprobada - FASE 1).
// Fuente unica de verdad del arbol de navegacion: el sidebar y el Command Menu
// consumen esta config. NO se hardcodea navegacion en componentes.
//
// Regla de esta fase: reagrupar sin romper rutas ni permisos. Cada item conserva
// su `path` real y su `perm` (mismo candado que ROUTE_PERMISSIONS en access.ts).
// El primer nivel del sidebar son las 8 categorias macro.
// ---------------------------------------------------------------------------

export type NavigationItem = {
  id: string;                    // = clave i18n del label (estable)
  label: MessageKey;
  path: string;
  perm?: string | string[];      // permiso(s) requerido(s); any-of si es arreglo; sin perm = libre
  absorbedInHub?: boolean;       // maestro que vive tambien en /catalog: se oculta para quien ve el hub
  badgeKey?: string;             // contador/indicador (Fase 2)
  phase?: "mvp" | "advanced";
  readOnly?: boolean;            // marca de "solo lectura" para el rol que lo consulta (badge en sidebar)
};

export type NavCategory = {
  id: string;
  label: MessageKey;             // etiqueta macro
  icon: string;                  // icono lucide definido en components/ui/icon.tsx (sin unicode)
  items: NavigationItem[];
};

// Las 8 categorias macro aprobadas. El orden es el del sidebar.
export const MACRO_NAV: NavCategory[] = [
  {
    id: "inicio", label: "nav.macro.inicio", icon: "home",
    items: [
      { id: "nav.dashboard", label: "nav.dashboard", path: "/dashboard", perm: "incident.read" },
      { id: "nav.workspace", label: "nav.workspace", path: "/workspace", perm: "incident.read" },
    ],
  },
  {
    id: "tickets", label: "nav.macro.tickets", icon: "inbox",
    items: [
      { id: "nav.incidents", label: "nav.incidents", path: "/incidents", perm: "incident.read" },
      { id: "nav.triage", label: "nav.triage", path: "/triage", perm: "triage.manage" },
      { id: "nav.majorincidents", label: "nav.majorincidents", path: "/major-incidents", perm: "major_incident.read" },
      { id: "nav.servicecatalog", label: "nav.servicecatalog", path: "/service-catalog", perm: "service_catalog.read" },
      { id: "nav.selfservice", label: "nav.selfservice", path: "/portal" },
      // nav.partner retirado (UX-007): el usuario final tiene UN solo hub (/portal). El portal de
      // partner externo (por organizacion/party) se reintroducira con gating por party en su fase.
    ],
  },
  {
    id: "operaciones", label: "nav.macro.operaciones", icon: "sliders",
    items: [
      { id: "nav.ophome", label: "nav.ophome", path: "/operaciones", perm: "incident.read" },
      { id: "nav.sla", label: "nav.sla", path: "/sla-governance", perm: "sla.read" },
      { id: "nav.customers", label: "nav.customers", path: "/customers", perm: "incident.read" },
      { id: "nav.frauddisputes", label: "nav.frauddisputes", path: "/fraud-disputes", perm: ["fraud.read", "dispute.read"] },
      { id: "nav.risk", label: "nav.risk", path: "/risk", perm: "risk.read" },
    ],
  },
  {
    id: "evolucion", label: "nav.macro.evolucion", icon: "zap",
    items: [
      { id: "nav.evhome", label: "nav.evhome", path: "/evolucion", perm: "project.read" },
      { id: "nav.tribemap", label: "nav.tribemap", path: "/evolucion/mapa", perm: "squad.read" },
      { id: "nav.projects", label: "nav.projects", path: "/projects", perm: "project.read" },
      { id: "nav.portfolio", label: "nav.portfolio", path: "/projects/portafolio", perm: "project.read" },
      { id: "nav.convertedcases", label: "nav.convertedcases", path: "/casos-convertidos", perm: ["project.read", "incident.read"] },
      { id: "nav.problems", label: "nav.problems", path: "/problems", perm: "problem.read" },
      { id: "nav.changes", label: "nav.changes", path: "/changes", perm: "change.read" },
      { id: "nav.squads", label: "nav.squads", path: "/squads", perm: "squad.read", absorbedInHub: true },
      { id: "nav.observability", label: "nav.observability", path: "/observability", perm: "observability.read" },
      { id: "nav.dependencies", label: "nav.dependencies", path: "/dependencies", perm: "cmdb.read" },
      { id: "nav.vendors", label: "nav.vendors", path: "/vendors", perm: "vendor.read" },
    ],
  },
  {
    id: "talento", label: "nav.macro.talento", icon: "users",
    items: [
      { id: "nav.talent", label: "nav.talent", path: "/talent", perm: "talent.read" },
      { id: "nav.resources", label: "nav.resources", path: "/workload", perm: "squad.read" },
      { id: "nav.areas", label: "nav.areas", path: "/delivery-areas", perm: "area.read" },
    ],
  },
  {
    id: "conocimiento", label: "nav.macro.conocimiento", icon: "sparkle",
    items: [
      { id: "nav.knowledge", label: "nav.knowledge", path: "/knowledge", perm: "knowledge.read" },
      { id: "nav.kbreview", label: "nav.kbreview", path: "/knowledge/revision", perm: "knowledge.manage" },
      { id: "nav.aicenter", label: "nav.aicenter", path: "/ai-center", perm: ["incident.read", "ai.read"] },
      { id: "nav.rules", label: "nav.rules", path: "/rules", perm: "rule.read" },
      { id: "nav.workflows", label: "nav.workflows", path: "/workflows", perm: "workflow.read" },
    ],
  },
  {
    id: "analitica", label: "nav.macro.analitica", icon: "activity",
    items: [
      { id: "nav.analytics", label: "nav.analytics", path: "/analytics", perm: ["incident.read", "analytics.read"] },
      { id: "nav.behavior", label: "nav.behavior", path: "/analytics/comportamiento", perm: ["incident.read", "analytics.read"] },
    ],
  },
  {
    id: "administracion", label: "nav.macro.administracion", icon: "gear",
    items: [
      { id: "nav.admin", label: "nav.admin", path: "/admin", perm: "user.manage" },
      { id: "nav.catalog", label: "nav.catalog", path: "/catalog", perm: "masterdata.manage" },
      { id: "nav.processes", label: "nav.processes", path: "/processes", perm: "process.read", absorbedInHub: true },
      { id: "nav.cmdb", label: "nav.cmdb", path: "/cmdb", perm: "cmdb.read" },
      { id: "nav.ledger", label: "nav.ledger", path: "/ledger", perm: "audit.read" },
    ],
  },
];

/** Todos los items en un arreglo plano (para el Command Menu y validaciones). */
export const ALL_NAV_ITEMS: NavigationItem[] = MACRO_NAV.flatMap((c) => c.items);

// ---------------------------------------------------------------------------
// Navegacion por rol (FASE Evolucion 1.2). El sidebar es global (MACRO_NAV) para casi
// todos los roles; el Gerente de Evolucion recibe un REAGRUPAMIENTO especifico de su
// persona (mismos items = mismos paths/permisos; NADA se elimina ni se crea). Se construye
// por referencia a los ids canonicos de MACRO_NAV para que paths/perms nunca diverjan (§11
// cero hardcode). canSeeNav sigue filtrando por permiso: el rol solo ve lo que puede abrir.
// ---------------------------------------------------------------------------

const ITEM_BY_ID: Record<string, NavigationItem> = Object.fromEntries(ALL_NAV_ITEMS.map((i) => [i.id, i]));

type RoleNavRef = { id: string; readOnly?: boolean; label?: MessageKey };
type RoleNavSpec = { id: string; label: MessageKey; icon: string; items: RoleNavRef[] };

function buildRoleNav(spec: RoleNavSpec[]): NavCategory[] {
  return spec.map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    items: c.items.map((ref) => {
      const base = ITEM_BY_ID[ref.id];
      if (!base) throw new Error(`nav de rol: referencia desconocida "${ref.id}"`);
      // Override solo de presentacion (label / readOnly); path y perm SIEMPRE del item canonico.
      if (ref.readOnly || ref.label) {
        return { ...base, ...(ref.readOnly ? { readOnly: true } : {}), ...(ref.label ? { label: ref.label } : {}) };
      }
      return base;
    }),
  }));
}

// Persona "Gerente de Evolucion" (product_owner). Sidebar por logica natural de trabajo:
// vision -> portafolio -> ejecucion -> analisis -> inteligencia -> conocimiento. Mismos items
// canonicos (paths/perms intactos); solo se reagrupan y se renombran etiquetas (override).
export const EVOLUTION_NAV: NavCategory[] = buildRoleNav([
  { id: "ev.evolucion", label: "nav.ev.evolucion", icon: "home", items: [
    { id: "nav.evhome", label: "nav.evx.control" },
  ] },
  { id: "ev.estrategia", label: "nav.ev.estrategia", icon: "star", items: [
    { id: "nav.portfolio" }, { id: "nav.projects" }, { id: "nav.tribemap" },
  ] },
  { id: "ev.ejecucion", label: "nav.ev.ejecucion", icon: "users", items: [
    { id: "nav.squads" }, { id: "nav.resources" }, { id: "nav.talent" }, { id: "nav.vendors" },
  ] },
  { id: "ev.analisis360", label: "nav.ev.analisis360", icon: "activity", items: [
    { id: "nav.behavior" }, { id: "nav.analytics", label: "nav.evx.analytics" }, { id: "nav.convertedcases" },
    { id: "nav.majorincidents", label: "nav.evx.majorinc" }, { id: "nav.problems", readOnly: true, label: "nav.evx.problems" },
    { id: "nav.changes", readOnly: true, label: "nav.evx.changes" },
    { id: "nav.selfservice", label: "nav.evx.mycases" }, { id: "nav.servicecatalog", label: "nav.evx.myrequests" },
  ] },
  { id: "ev.inteligencia", label: "nav.ev.inteligencia", icon: "sparkle", items: [
    { id: "nav.aicenter" }, { id: "nav.rules" }, { id: "nav.workflows" }, { id: "nav.processes" },
  ] },
  { id: "ev.km", label: "nav.ev.km", icon: "folder", items: [
    { id: "nav.knowledge", label: "nav.evx.km" },
  ] },
]);

// Persona "Gerente de Operaciones" (support_lead). Mesa de ayuda / service management (ITIL·ITSM):
// decision -> casos -> equipo -> clientes/riesgo -> servicio -> analitica. Mismos items canonicos
// (paths/perms intactos); reagrupacion + renombres de presentacion. La UNICA ventana hacia
// Evolucion es "Casos en Evolucion" (nav.convertedcases) en SOLO LECTURA: el ancla del caso que
// Operaciones derivo, para comunicar avances al cliente (sin WSJF/ROI/squads). La segregacion dura
// (no ver Proyectos/Portafolio/Squads/Tribus/Reglas/AI aunque tenga el perm) es de capa de
// aplicacion: ROLE_ROUTE_DENY en access.ts + el guard del layout.
export const OPERATIONS_NAV: NavCategory[] = buildRoleNav([
  { id: "op.torre", label: "nav.op.torre", icon: "home", items: [
    { id: "nav.ophome" },
  ] },
  { id: "op.analitica", label: "nav.op.analitica", icon: "activity", items: [
    { id: "nav.analytics" }, { id: "nav.behavior" },
  ] },
  { id: "op.casos", label: "nav.op.casos", icon: "inbox", items: [
    { id: "nav.triage" }, { id: "nav.incidents" }, { id: "nav.majorincidents" }, { id: "nav.sla" },
    { id: "nav.convertedcases", readOnly: true, label: "nav.opx.evolcases" },
  ] },
  { id: "op.equipo", label: "nav.op.equipo", icon: "users", items: [
    { id: "nav.resources", label: "nav.opx.workload" }, { id: "nav.talent", label: "nav.opx.performance" },
  ] },
  { id: "op.clientes", label: "nav.op.clientes", icon: "shield", items: [
    { id: "nav.customers" }, { id: "nav.frauddisputes" }, { id: "nav.risk" },
  ] },
  { id: "op.servicio", label: "nav.op.servicio", icon: "sliders", items: [
    { id: "nav.servicecatalog" }, { id: "nav.selfservice" }, { id: "nav.knowledge" },
  ] },
]);

// Persona "Miembro de Squad" (squad_member). Ve SOLO lo suyo: su trabajo, sus squads, sus
// iniciativas (sin financieros/WSJF/hilo del caso ancla), su perfil. Rutas nuevas /mi-* con datos
// acotados a la persona; la segregacion dura (no ver Portafolio/Torre/Workload/Squads global/Mapa
// de Tribus) es de capa de aplicacion (ROLE_ROUTE_DENY + guard). §0.
export const SQUAD_MEMBER_NAV: NavCategory[] = [
  { id: "sm.trabajo", label: "nav.sm.trabajo", icon: "inbox", items: [
    { id: "nav.mywork", label: "nav.mywork", path: "/mi-trabajo", perm: "project.read" },
  ] },
  { id: "sm.squads", label: "nav.sm.squads", icon: "users", items: [
    { id: "nav.mysquad", label: "nav.mysquad", path: "/mi-squad", perm: "squad.read" },
  ] },
  { id: "sm.iniciativas", label: "nav.sm.iniciativas", icon: "zap", items: [
    { id: "nav.myinitiatives", label: "nav.myinitiatives", path: "/mis-iniciativas", perm: "project.read" },
  ] },
  { id: "sm.perfil", label: "nav.sm.perfil", icon: "user", items: [
    { id: "nav.myprofile", label: "nav.myprofile", path: "/mi-perfil", perm: "project.read" },
  ] },
  { id: "sm.ayuda", label: "nav.sm.ayuda", icon: "help", items: [
    ITEM_BY_ID["nav.selfservice"], ITEM_BY_ID["nav.knowledge"],
  ].filter(Boolean) },
];

// Persona "Operador" (support_agent). Service Desk que ejecuta SOLO sus casos asignados. Ve su dia,
// sus casos, la cola del equipo en SOLO LECTURA (contexto), puede crear casos como solicitante,
// leer/proponer KB, ver su desempeno y sus notificaciones. No admite, no asigna, no toma de la cola,
// no declara MI, no gestiona a otros. La segregacion dura (dashboard/torre/gobierno SLA/clientes/
// fraude/talento/analitica/admin) es de capa de aplicacion (ROLE_ROUTE_DENY + guard) + perms
// recortados (sql/0112) + regla de oro backend (lib/auth/incident-authz).
export const SUPPORT_AGENT_NAV: NavCategory[] = [
  { id: "ag.dia", label: "nav.ag.dia", icon: "home", items: [
    { id: "nav.miday", label: "nav.miday", path: "/mi-dia", perm: "incident.read" },
  ] },
  { id: "ag.casos", label: "nav.ag.casos", icon: "inbox", items: [
    { id: "nav.miscasos", label: "nav.miscasos", path: "/mis-casos", perm: "incident.read" },
    { id: "nav.colaequipo", label: "nav.colaequipo", path: "/cola-equipo", perm: "incident.read", readOnly: true },
  ] },
  { id: "ag.crear", label: "nav.ag.crear", icon: "plus", items: [
    { ...ITEM_BY_ID["nav.selfservice"], label: "nav.ag.crearcaso" },
    { ...ITEM_BY_ID["nav.servicecatalog"], label: "nav.ag.catalogo" },
  ] },
  { id: "ag.kb", label: "nav.ag.kb", icon: "sparkle", items: [ITEM_BY_ID["nav.knowledge"]] },
  { id: "ag.yo", label: "nav.ag.yo", icon: "user", items: [
    { id: "nav.midesempeno", label: "nav.midesempeno", path: "/mi-desempeno", perm: "incident.read" },
    { id: "nav.notificaciones", label: "nav.notificaciones", path: "/notificaciones" },
  ] },
];

// Persona "Usuario final" (partner_user). Portal enfocado: registrar/consultar; sus casos viven
// en el hub /portal. Menu PLANO (sin categorias colapsables) + CTA de registro, renderizado por
// sidebar.tsx. Mismos items canonicos (paths/perms intactos); canSeeNav sigue filtrando por permiso
// (si no tiene knowledge.read/service_catalog.read, esos items no se muestran). No toca RBAC.
export const USER_NAV: NavCategory[] = [
  { id: "user.space", label: "nav.user.space", icon: "home", items: [
    { ...ITEM_BY_ID["nav.selfservice"], label: "nav.user.selfservice" },
    { ...ITEM_BY_ID["nav.knowledge"], label: "nav.user.knowledge" },
    { ...ITEM_BY_ID["nav.servicecatalog"], label: "nav.user.catalog" },
  ] },
];

// Overlay de nav por persona interna. La segregacion aplica SOLO a un usuario de UNA persona (ver
// solePersona en access.ts); un multi-persona recibe MACRO_NAV (nav completa, cada item gateado por
// su perm), coherente con isRouteDeniedForRoles.
const PERSONA_NAV: Record<string, NavCategory[]> = {
  support_lead: OPERATIONS_NAV,
  support_agent: SUPPORT_AGENT_NAV,
  product_owner: EVOLUTION_NAV,
  squad_member: SQUAD_MEMBER_NAV,
};

/** Arbol de navegacion para un conjunto de roles: overlay de persona SOLO para un usuario de UNA
 *  sola persona interna; un multi-persona (o admin) recibe MACRO_NAV. partner_user (externo) usa el
 *  portal (USER_NAV). Un multi-rol NO queda restringido a la persona mas acotada. */
export function navForRoles(roles: string[], isAdmin: boolean): NavCategory[] {
  if (isAdmin) return MACRO_NAV;
  if (roles.includes("partner_user")) return USER_NAV;
  const persona = solePersona(roles);
  return persona ? PERSONA_NAV[persona] : MACRO_NAV;
}

/** true si el arbol del usuario es el portal enfocado (partner_user): el sidebar lo renderiza
 *  PLANO + CTA de registro, en vez de categorias colapsables. Admin siempre recibe MACRO_NAV. */
export function isPortalNav(roles: string[], isAdmin: boolean): boolean {
  return navForRoles(roles, isAdmin) === USER_NAV;
}

/** Menu del portal (presentacion, no dato de negocio): 5 destinos. Inicio/Autoservicio/Mis casos
 *  son PESTANAS del hub /portal (?tab=); Conocimiento/Catalogo son rutas reales. El icono es del set
 *  lineal; 'mycases' pinta el badge azul con el nro de casos activos. Las rutas NO cambian. */
export type PortalMenuItem = { id: string; label: MessageKey; href: string; icon: string; tab?: string; badge?: "mycases" };
export const USER_PORTAL_MENU: PortalMenuItem[] = [
  { id: "inicio",        label: "nav.user.home",        href: "/portal",                 icon: "home",    tab: "inicio" },
  { id: "autoservicio",  label: "nav.user.selfservice", href: "/portal?tab=autoservicio", icon: "sliders", tab: "autoservicio" },
  { id: "miscasos",      label: "nav.user.mycases",     href: "/portal?tab=miscasos",     icon: "inbox",   tab: "miscasos", badge: "mycases" },
  { id: "conocimiento",  label: "nav.user.knowledge",   href: "/knowledge",              icon: "sparkle" },
  { id: "catalogo",      label: "nav.user.catalog",     href: "/service-catalog",        icon: "folder" },
];

/** Categoria que contiene una ruta (por prefijo mas especifico). */
export function categoryOfPath(pathname: string): string | null {
  let best: { id: string; len: number } | null = null;
  for (const cat of MACRO_NAV) {
    for (const it of cat.items) {
      if (pathname === it.path || pathname.startsWith(it.path + "/")) {
        if (!best || it.path.length > best.len) best = { id: cat.id, len: it.path.length };
      }
    }
  }
  return best?.id ?? null;
}

// Accesos rapidos del Command Menu: acciones de creacion sobre rutas /new existentes.
export type QuickAction = { id: string; label: MessageKey; path: string; perm?: string | string[] };
export const QUICK_ACTIONS: QuickAction[] = [
  // La visibilidad espeja el guard de la RUTA destino (/incidents -> incident.read), no solo la
  // capacidad de crear. El form /incidents/new es de staff; el usuario final (incident.create sin
  // incident.read) reporta por /portal. Evita ofrecer un atajo que caeria en /unauthorized (UX-005).
  { id: "qa.newIncident", label: "cmd.action.newIncident", path: "/incidents/new", perm: "incident.read" },
  { id: "qa.newProject", label: "cmd.action.newProject", path: "/projects/new", perm: "project.manage" },
  { id: "qa.newChange", label: "cmd.action.newChange", path: "/changes/new", perm: "change.manage" },
  { id: "qa.newProblem", label: "cmd.action.newProblem", path: "/problems/new", perm: "problem.manage" },
];
