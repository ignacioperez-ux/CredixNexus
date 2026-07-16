import type { MessageKey } from "@/lib/i18n/dictionaries";
import { MACRO_NAV, EVOLUTION_NAV, OPERATIONS_NAV, SQUAD_MEMBER_NAV, SUPPORT_AGENT_NAV } from "./navigation";
import { canSeeNav, requiredPermForPath, defaultHome } from "./access";

// ---------------------------------------------------------------------------
// Experiencia de navegacion por rol (FASE 2). Fuente unica de como se comporta
// el sidebar/landing por persona. Separa TRES ejes:
//   - Visibilidad -> `perm` por item en navigation.ts (candado real). Aqui NO se decide.
//   - Enfasis     -> `emphasis`: categorias macro que forman el "cockpit" del rol y se
//                    AUTO-EXPANDEN en el sidebar (progressive disclosure declarativo).
//   - Experiencia -> `home` (landing) y `primaryAction` (accion primaria), declarados aqui
//                    para engancharse en los siguientes pasos de Fase 2 (redirect + CTA).
//
// `emphasis` referencia ids de categoria de MACRO_NAV (no claves de item): mover un item
// entre categorias NO altera el enfasis. Admin (isAdmin) no fuerza enfasis: ve todo y solo
// se auto-expande la categoria activa.
// ---------------------------------------------------------------------------

export type PrimaryAction =
  | "newTicket" | "newProject" | "newChange" | "takeNext" | "assignTicket"
  | "openBacklog" | "reportCase" | "evaluate" | "verifyLedger";

// Registro de la accion primaria: etiqueta i18n, destino real, permiso e icono lucide.
export type PrimaryActionDef = { label: MessageKey; route: string; perm?: string; icon: string };
export const PRIMARY_ACTIONS: Record<PrimaryAction, PrimaryActionDef> = {
  newTicket:    { label: "pa.newTicket",    route: "/incidents/new", perm: "incident.read", icon: "plus" },
  newProject:   { label: "pa.newProject",   route: "/projects/new",  perm: "project.manage",  icon: "plus" },
  newChange:    { label: "pa.newChange",    route: "/changes/new",   perm: "change.manage",   icon: "plus" },
  takeNext:     { label: "pa.takeNext",     route: "/workspace",     perm: "incident.read",   icon: "inbox" },
  assignTicket: { label: "pa.assign",       route: "/triage",        perm: "triage.manage",   icon: "inbox" },
  openBacklog:  { label: "pa.backlog",      route: "/projects",      perm: "project.read",    icon: "zap" },
  reportCase:   { label: "pa.report",       route: "/portal?report=1",                        icon: "plus" },
  evaluate:     { label: "pa.evaluate",     route: "/talent",        perm: "talent.read",     icon: "users" },
  verifyLedger: { label: "pa.verifyLedger", route: "/ledger",        perm: "audit.read",      icon: "shield" },
};

export type RoleUx = {
  emphasis: string[];        // ids de categoria macro a auto-expandir
  home?: string;             // ruta de landing preferida (Fase 2: wire en el redirect)
  primaryAction?: PrimaryAction;
};

// Codigo de rol (tabla `role`) -> experiencia. Roles no listados => sin enfasis forzado.
export const ROLE_UX: Record<string, RoleUx> = {
  // Admin: vista total, sin enfasis forzado (solo se abre la categoria activa).
  system_admin: { emphasis: [], home: "/dashboard", primaryAction: "newTicket" },
  tenant_admin: { emphasis: [], home: "/dashboard", primaryAction: "newTicket" },

  // Gte. Operaciones -> Torre de Control de Operaciones (persona OPERATIONS_NAV). Home en su Torre;
  // auto-expande sus bloques de persona. Se conservan ids MACRO para el caso multi-rol que renderiza
  // MACRO_NAV (p.ej. support_lead + admin), donde el overlay no aplica.
  support_lead: { emphasis: ["op.torre", "op.casos", "op.clientes", "tickets", "operaciones", "analitica"], home: "/operaciones", primaryAction: "assignTicket" },
  // Operador -> "Mi dia" (persona SUPPORT_AGENT_NAV). NO toma casos: los recibe asignados, por eso
  // se elimina "Tomar siguiente" (primaryAction) y el CTA pasa a "Crear caso" (reportar como usuario).
  support_agent: { emphasis: ["ag.dia", "ag.casos"], home: "/mi-dia", primaryAction: "reportCase" },
  // Gte. Evolucion/TI -> Transformation Hub (gestiona mejoras y proyectos)
  // Gerente de Evolucion: home en Proyectos (portafolio); ya no ve el dashboard operativo (segregacion 1.1).
  // Navegacion de persona (EVOLUTION_NAV, 1.2): auto-expande sus bloques "ev.evolucion"/"ev.gobierno".
  // Se conservan los ids MACRO ("evolucion"/"conocimiento"/"analitica") para el caso multi-rol que
  // renderiza MACRO_NAV (p.ej. product_owner + support_agent), donde el overlay no aplica.
  product_owner: { emphasis: ["evolucion", "conocimiento", "analitica", "ev.evolucion", "ev.estrategia", "ev.analisis360"], home: "/evolucion", primaryAction: "newProject" },
  // Miembro de Squad -> "Mi trabajo" (persona SQUAD_MEMBER_NAV). Ve solo lo suyo. CTA para
  // reportar un caso por el portal (no tiene acceso al backlog global). Se conservan ids MACRO
  // para el caso multi-rol que renderiza MACRO_NAV.
  squad_member: { emphasis: ["sm.trabajo", "sm.squads", "sm.iniciativas", "evolucion", "conocimiento"], home: "/mi-trabajo", primaryAction: "reportCase" },
  // Usuario final -> Autoservicio simple
  // Usuario final: sin CTA en el header (el intake ya vive en /portal). Sin primaryAction, el
  // fallback newTicket exige incident.read (que no tiene) -> resolvePrimaryAction devuelve null.
  partner_user: { emphasis: ["tickets", "conocimiento"], home: "/portal" },

  // Roles adyacentes (heredan de la persona mas cercana)
  business_owner: { emphasis: ["operaciones", "analitica"], home: "/analytics" },
  grc_officer: { emphasis: ["operaciones", "analitica", "administracion"], home: "/analytics" },
  change_manager: { emphasis: ["evolucion", "tickets"], home: "/changes", primaryAction: "newChange" },
  auditor: { emphasis: ["analitica", "administracion"], home: "/ledger", primaryAction: "verifyLedger" },
  people_lead: { emphasis: ["talento", "evolucion"], home: "/talent", primaryAction: "evaluate" },
  responsable_comercial: { emphasis: ["tickets", "operaciones", "conocimiento"], home: "/portal" },
};

/** Categorias macro a auto-expandir para un conjunto de roles. Admin => vacio (solo activa). */
export function emphasisForRoles(roles: string[], isAdmin: boolean): Set<string> {
  const out = new Set<string>();
  if (isAdmin) return out;
  for (const r of roles) for (const cat of ROLE_UX[r]?.emphasis ?? []) out.add(cat);
  return out;
}

/** Landing preferido segun el primer rol con `home` declarado (Fase 2). */
export function homeForRoles(roles: string[]): string | null {
  for (const r of roles) { const h = ROLE_UX[r]?.home; if (h) return h; }
  return null;
}

/** Home efectivo al ingresar: usa el `home` del rol SOLO si el usuario puede abrirlo
 *  (mismo candado de permiso que el guard de ruta); si no, cae al heuristico defaultHome. */
export function resolveHome(roles: string[], perms: string[], isAdmin: boolean): string {
  const home = homeForRoles(roles);
  if (home && canSeeNav(requiredPermForPath(home), perms, isAdmin)) return home;
  return defaultHome(perms, isAdmin);
}

/** Accion primaria efectiva (CTA del header): la primera declarada por los roles del usuario
 *  que este PERMITIDA; si ninguna aplica, cae a "Nuevo ticket"; si tampoco, no hay CTA. */
export function resolvePrimaryAction(roles: string[], perms: string[], isAdmin: boolean): (PrimaryActionDef & { code: PrimaryAction }) | null {
  const codes: PrimaryAction[] = [];
  for (const r of roles) { const a = ROLE_UX[r]?.primaryAction; if (a) codes.push(a); }
  codes.push("newTicket"); // fallback universal
  for (const code of codes) {
    const def = PRIMARY_ACTIONS[code];
    if (def && canSeeNav(def.perm, perms, isAdmin)) return { code, ...def };
  }
  return null;
}

// Guard de coherencia: todos los ids de emphasis existen como categoria (macro o de persona).
const CATEGORY_IDS = new Set([...MACRO_NAV, ...EVOLUTION_NAV, ...OPERATIONS_NAV, ...SQUAD_MEMBER_NAV, ...SUPPORT_AGENT_NAV].map((c) => c.id));
export function unknownEmphasisIds(): string[] {
  const bad: string[] = [];
  for (const ux of Object.values(ROLE_UX)) for (const id of ux.emphasis) if (!CATEGORY_IDS.has(id)) bad.push(id);
  return bad;
}
