import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

// KIT DE CAPTURAS — Manual de Pantallas de Credix Nexus.
// Recorre las 85 pantallas y guarda un PNG de pagina completa por ruta, agrupado por tema y persona.
// - No levanta el server (CLAUDE.md §3.1 #4): usa el que tiene arriba el usuario (reuseExistingServer).
// - Autenticacion: reusa los storageState de auth.setup.ts (una persona por bloque via test.use). Un
//   bloque se saltea si su .auth/<persona>.json no existe (faltan credenciales E2E).
// - Asignacion de rutas por persona segun PERMISOS REALES (verificados en BD): operaciones@ es
//   multi-rol (MACRO_NAV, sin denylist) y captura el grueso staff; evolucion@ cubre reglas/
//   conocimiento/vendors-edit; operador@ cubre cmdb/dependencias; usuario@ el portal; squads@ sus
//   pantallas. Las pantallas SOLO-ADMIN (risk, admin, sso, catalog, ledger, problems new/edit)
//   necesitan la cuenta admin y se saltean si no hay e2e/.auth/admin.json.
// - Detalle ([id]): ids reales de e2e/screenshots/sample-ids.json (deterministico); el caso del
//   portal se resuelve en runtime (pertenece al usuario final).
// - Tema: se fuerza escribiendo localStorage 'credix.theme' (nexus|claro) y recargando. Por defecto
//   1 tema por persona; CAPTURE_THEMES=both captura ambos.
// Salida: e2e/screenshots/<tema>/<archivo>.png

const IDS: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "e2e/screenshots/sample-ids.json"), "utf8"),
);
const BOTH = process.env.CAPTURE_THEMES === "both";
type Theme = "nexus" | "claro";

type Shot = { name: string; path: string };
type Persona = { name: string; state?: string; anon?: boolean; themes: Theme[]; shots: Shot[] };

const S = (path: string, name: string): Shot => ({ path, name });

// --- operaciones@ (support_lead + responsable_comercial => MACRO_NAV): grueso de pantallas staff ---
const OPS_STAFF: Shot[] = [
  S("/dashboard", "dashboard"), S("/workspace", "workspace"),
  S("/incidents", "incidents"), S("/incidents/new", "incidents__new"),
  S(`/incidents/${IDS.incident}`, "incidents__id"), S(`/incidents/${IDS.incident}/edit`, "incidents__id__edit"),
  S("/triage", "triage"),
  S("/major-incidents", "major-incidents"), S(`/major-incidents/${IDS.major_incident}`, "major-incidents__id"),
  S("/service-catalog", "service-catalog"), S(`/service-catalog/requests/${IDS.service_request}`, "service-catalog__requests__id"),
  S("/sla-governance", "sla-governance"),
  S("/customers", "customers"), S(`/customers/${IDS.party}`, "customers__id"),
  S("/fraud-disputes", "fraud-disputes"),
  S(`/fraud-disputes/fraud/${IDS.fraud_case}`, "fraud-disputes__fraud__id"),
  S(`/fraud-disputes/dispute/${IDS.dispute_case}`, "fraud-disputes__dispute__id"),
  S("/analytics", "analytics"), S("/analytics/comportamiento", "analytics__comportamiento"),
  S("/casos-convertidos", "casos-convertidos"),
  S("/operaciones", "operaciones__resumen"), S("/operaciones?tab=operacion", "operaciones__operacion"),
  S("/operaciones?tab=analitica", "operaciones__analitica"),
  S("/evolucion", "evolucion"), S("/evolucion/mapa", "evolucion__mapa"),
  S("/projects", "projects"), S("/projects/new", "projects__new"),
  S(`/projects/${IDS.project}`, "projects__id"), S(`/projects/${IDS.project}/edit`, "projects__id__edit"),
  S("/projects/portafolio", "projects__portafolio"),
  S("/problems", "problems"), S(`/problems/${IDS.problem}`, "problems__id"),
  S("/changes", "changes"), S("/changes/new", "changes__new"),
  S(`/changes/${IDS.change_request}`, "changes__id"), S(`/changes/${IDS.change_request}/edit`, "changes__id__edit"),
  S("/squads", "squads"), S(`/squads/${IDS.squad}`, "squads__id"),
  S("/observability", "observability"),
  S("/vendors", "vendors"), S(`/vendors/${IDS.vendor}`, "vendors__id"),
  S("/talent", "talent"), S(`/talent/${IDS.team_member}`, "talent__id"),
  S("/workload", "workload"), S("/delivery-areas", "delivery-areas"),
  S("/knowledge/revision", "knowledge__revision"),
  S("/ai-center", "ai-center"),
  S("/workflows", "workflows"), S(`/workflows/${IDS.workflow_instance}`, "workflows__id"),
  S(`/workflows/definitions/${IDS.workflow_definition}`, "workflows__definitions__id"),
  S("/processes", "processes"), S(`/processes/${IDS.process}`, "processes__id"),
  S("/start", "start"), S("/unauthorized", "unauthorized"),
];

// --- evolucion@ (product_owner): reglas/conocimiento/vendors-edit + su experiencia de persona ---
const EVO_SHOTS: Shot[] = [
  S("/rules", "rules"),
  S("/knowledge", "knowledge"), S(`/knowledge/${IDS.knowledge_article}`, "knowledge__id"),
  S("/vendors/new", "vendors__new"), S(`/vendors/${IDS.vendor}/edit`, "vendors__id__edit"),
  S("/evolucion", "evolucion__persona"), S("/projects/portafolio", "portafolio__persona"),
];

// --- operador@ (support_agent): cmdb/dependencias + su dia ---
const OPERADOR_SHOTS: Shot[] = [
  S("/cmdb", "cmdb"), S("/dependencies", "dependencies"),
  S("/mi-dia", "mi-dia"), S("/mis-casos", "mis-casos"), S("/cola-equipo", "cola-equipo"),
  S("/mi-desempeno", "mi-desempeno"), S("/notificaciones", "notificaciones"),
];

// --- SOLO-ADMIN (necesitan e2e/.auth/admin.json): se saltean si no hay credenciales admin ---
const ADMIN_ONLY: Shot[] = [
  S("/risk", "risk"),
  S("/admin", "admin"), S("/admin/sso-domains", "admin__sso-domains"),
  S("/catalog", "catalog"), S(`/catalog/${IDS.catalog_key}`, "catalog__catalog"),
  S(`/catalog/${IDS.catalog_key}/new`, "catalog__catalog__new"),
  S("/ledger", "ledger"),
  S("/problems/new", "problems__new"), S(`/problems/${IDS.problem}/edit`, "problems__id__edit"),
];

const PERSONAS: Persona[] = [
  { name: "anon", anon: true, themes: ["nexus"], shots: [S("/", "landing"), S("/login", "login")] },
  { name: "operaciones", state: "e2e/.auth/operaciones.json", themes: BOTH ? ["nexus", "claro"] : ["nexus"], shots: OPS_STAFF },
  { name: "evolucion", state: "e2e/.auth/evolucion.json", themes: BOTH ? ["nexus", "claro"] : ["nexus"], shots: EVO_SHOTS },
  { name: "operador", state: "e2e/.auth/operador.json", themes: BOTH ? ["nexus", "claro"] : ["nexus"], shots: OPERADOR_SHOTS },
  { name: "usuario", state: "e2e/.auth/usuario.json", themes: BOTH ? ["claro", "nexus"] : ["claro"], shots: [
    S("/portal", "portal__inicio"),
    S("/portal?tab=miscasos", "portal__miscasos"),
    { name: "portal__cases__id", path: "__RESOLVE_PORTAL_CASE__" },
    S("/knowledge", "portal__knowledge"),
    S("/service-catalog", "portal__service-catalog"),
  ] },
  { name: "squads", state: "e2e/.auth/squads.json", themes: BOTH ? ["nexus", "claro"] : ["nexus"], shots: [
    S("/mi-trabajo", "mi-trabajo"), S("/mi-squad", "mi-squad"),
    S("/mis-iniciativas", "mis-iniciativas"), S("/mi-perfil", "mi-perfil"),
  ] },
  { name: "admin", state: "e2e/.auth/admin.json", themes: BOTH ? ["nexus", "claro"] : ["nexus"], shots: ADMIN_ONLY },
];

async function applyTheme(page: Page, theme: Theme) {
  await page.evaluate((t) => localStorage.setItem("credix.theme", t), theme).catch(() => {});
  await page.reload({ waitUntil: "load" }).catch(() => {});
}

async function settle(page: Page) {
  await page.waitForLoadState("load").catch(() => {});
  await page.locator("body").waitFor({ state: "visible" }).catch(() => {});
  await page.waitForTimeout(900); // deja render de charts/realtime antes del disparo
}

function outPath(theme: Theme, name: string) {
  const out = path.join(process.cwd(), "e2e/screenshots", theme, `${name}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  return out;
}

async function shoot(page: Page, theme: Theme, route: string, name: string) {
  await page.goto(route, { waitUntil: "load" }).catch(() => {});
  await applyTheme(page, theme);
  await settle(page);
  // Deteccion de redireccion a /unauthorized: no guardamos una imagen enganosa; fallamos el test para
  // que quede claro que esa ruta necesita otro rol (p. ej. admin).
  const pathname = new URL(page.url()).pathname;
  if (name !== "unauthorized" && pathname === "/unauthorized") {
    throw new Error(`ruta ${route} redirige a /unauthorized para esta persona (falta permiso)`);
  }
  await page.screenshot({ path: outPath(theme, name), fullPage: true });
  await expect(page.locator("body")).toBeVisible();
}

async function shootPortalCase(page: Page, theme: Theme) {
  await page.goto("/portal?tab=miscasos", { waitUntil: "load" }).catch(() => {});
  await applyTheme(page, theme);
  await settle(page);
  const link = page.locator('a[href*="/portal/cases/"]').first();
  if (await link.count()) await link.click().catch(() => {});
  else await page.getByText(/INC-\d{4}-\d+/).first().click().catch(() => {});
  await page.waitForURL(/\/portal\/cases\//, { timeout: 8000 }).catch(() => {});
  await settle(page);
  await page.screenshot({ path: outPath(theme, "portal__cases__id"), fullPage: true });
}

for (const persona of PERSONAS) {
  test.describe(`capturas · ${persona.name}`, () => {
    if (persona.anon) test.use({ storageState: { cookies: [], origins: [] } });
    else {
      test.skip(!fs.existsSync(path.join(process.cwd(), persona.state!)),
        `Sin sesion para ${persona.name} (falta ${persona.state}; define E2E_${persona.name.toUpperCase()}_EMAIL/PASSWORD)`);
      test.use({ storageState: persona.state! });
    }

    for (const theme of persona.themes) {
      for (const shot of persona.shots) {
        test(`[${theme}] ${shot.name}`, async ({ page }) => {
          if (shot.path === "__RESOLVE_PORTAL_CASE__") await shootPortalCase(page, theme);
          else await shoot(page, theme, shot.path, shot.name);
        });
      }
    }
  });
}
