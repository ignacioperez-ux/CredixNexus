import type { MessageKey } from "@/lib/i18n/dictionaries";

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
      { id: "nav.partner", label: "nav.partner", path: "/partner" },
    ],
  },
  {
    id: "operaciones", label: "nav.macro.operaciones", icon: "sliders",
    items: [
      { id: "nav.sla", label: "nav.sla", path: "/sla-governance", perm: "sla.read" },
      { id: "nav.customers", label: "nav.customers", path: "/customers", perm: "incident.read" },
      { id: "nav.frauddisputes", label: "nav.frauddisputes", path: "/fraud-disputes", perm: ["fraud.read", "dispute.read"] },
      { id: "nav.risk", label: "nav.risk", path: "/risk", perm: "risk.read" },
    ],
  },
  {
    id: "evolucion", label: "nav.macro.evolucion", icon: "zap",
    items: [
      { id: "nav.projects", label: "nav.projects", path: "/projects", perm: "project.read" },
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
      { id: "nav.aicenter", label: "nav.aicenter", path: "/ai-center", perm: "incident.read" },
      { id: "nav.rules", label: "nav.rules", path: "/rules", perm: "rule.read" },
      { id: "nav.workflows", label: "nav.workflows", path: "/workflows", perm: "workflow.read" },
    ],
  },
  {
    id: "analitica", label: "nav.macro.analitica", icon: "activity",
    items: [
      { id: "nav.analytics", label: "nav.analytics", path: "/analytics", perm: "incident.read" },
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
  { id: "qa.newIncident", label: "cmd.action.newIncident", path: "/incidents/new", perm: "incident.create" },
  { id: "qa.newProject", label: "cmd.action.newProject", path: "/projects/new", perm: "project.manage" },
  { id: "qa.newChange", label: "cmd.action.newChange", path: "/changes/new", perm: "change.manage" },
  { id: "qa.newProblem", label: "cmd.action.newProblem", path: "/problems/new", perm: "problem.manage" },
];
