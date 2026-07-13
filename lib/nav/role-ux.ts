import { MACRO_NAV } from "./navigation";

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
  | "assignTicket" | "takeNext" | "newTicket" | "newProject" | "openBacklog"
  | "evaluate" | "verifyLedger" | "newRecord";

export type RoleUx = {
  emphasis: string[];        // ids de categoria macro a auto-expandir
  home?: string;             // ruta de landing preferida (Fase 2: wire en el redirect)
  primaryAction?: PrimaryAction;
};

// Codigo de rol (tabla `role`) -> experiencia. Roles no listados => sin enfasis forzado.
export const ROLE_UX: Record<string, RoleUx> = {
  // Admin: vista total, sin enfasis forzado (solo se abre la categoria activa).
  system_admin: { emphasis: [], home: "/dashboard", primaryAction: "newRecord" },
  tenant_admin: { emphasis: [], home: "/dashboard", primaryAction: "newRecord" },

  // Gte. Operaciones -> Command Center
  support_lead: { emphasis: ["tickets", "operaciones", "analitica"], home: "/dashboard", primaryAction: "assignTicket" },
  // Operador -> Work Queue
  support_agent: { emphasis: ["inicio", "tickets", "conocimiento"], home: "/workspace", primaryAction: "takeNext" },
  // Gte. Evolucion/TI -> Transformation Hub
  product_owner: { emphasis: ["evolucion", "conocimiento", "analitica"], home: "/dashboard", primaryAction: "newProject" },
  // Squad -> Delivery Hub
  squad_member: { emphasis: ["evolucion", "conocimiento"], home: "/projects", primaryAction: "openBacklog" },
  // Usuario final -> Autoservicio simple
  partner_user: { emphasis: ["tickets", "conocimiento"], home: "/portal", primaryAction: "newTicket" },

  // Roles adyacentes (heredan de la persona mas cercana)
  business_owner: { emphasis: ["operaciones", "analitica"], home: "/analytics" },
  grc_officer: { emphasis: ["operaciones", "analitica", "administracion"], home: "/analytics" },
  change_manager: { emphasis: ["evolucion", "tickets"], home: "/changes", primaryAction: "newProject" },
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

// Guard de coherencia: todos los ids de emphasis existen como categoria macro.
const CATEGORY_IDS = new Set(MACRO_NAV.map((c) => c.id));
export function unknownEmphasisIds(): string[] {
  const bad: string[] = [];
  for (const ux of Object.values(ROLE_UX)) for (const id of ux.emphasis) if (!CATEGORY_IDS.has(id)) bad.push(id);
  return bad;
}
