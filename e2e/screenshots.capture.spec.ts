import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

// KIT DE CAPTURAS — Manual de Pantallas de Credix Nexus.
// Recorre las 85 pantallas y guarda un PNG de pagina completa por ruta, agrupado por tema y persona.
// - No levanta el server (CLAUDE.md §3.1 #4): usa el que tiene arriba el usuario (reuseExistingServer).
// - Autenticacion: reusa los storageState que produce auth.setup.ts (una persona por bloque via
//   test.use). Un bloque se saltea si su .auth/<persona>.json no existe (faltan credenciales E2E).
// - Detalle ([id]): ids de muestra reales en e2e/screenshots/sample-ids.json (deterministico); el caso
//   del portal se resuelve en runtime (pertenece al usuario final).
// - Tema: se fuerza escribiendo localStorage 'credix.theme' (nexus|claro) y recargando; el
//   ThemeProvider lo aplica. Por defecto 1 tema por persona; CAPTURE_THEMES=both captura ambos.
// Salida: e2e/screenshots/<tema>/<archivo>.png

const IDS: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "e2e/screenshots/sample-ids.json"), "utf8"),
);
const BOTH = process.env.CAPTURE_THEMES === "both";
type Theme = "nexus" | "claro";

type Shot = { name: string; path: string };
type Persona = { name: string; state: string; themes: Theme[]; shots: Shot[] };

// Nombre de archivo a partir de la ruta: '/incidents/[id]' -> 'incidents__id'.
const fname = (route: string) =>
  route.replace(/^\//, "").replace(/\?.*$/, "").replace(/[/[]/g, "__").replace(/\]/g, "").replace(/=/g, "-") || "home";

const S = (path: string, name?: string): Shot => ({ path, name: name ?? fname(path) });

// --- Rutas GLOBALES/STAFF (persona admin: ve todo, sin denylist) ---
const ADMIN_SHOTS: Shot[] = [
  S("/dashboard"), S("/workspace"),
  S("/incidents"), S("/incidents/new"),
  S(`/incidents/${IDS.incident}`, "incidents__id"), S(`/incidents/${IDS.incident}/edit`, "incidents__id__edit"),
  S("/triage"),
  S("/major-incidents"), S(`/major-incidents/${IDS.major_incident}`, "major-incidents__id"),
  S("/service-catalog"), S(`/service-catalog/requests/${IDS.service_request}`, "service-catalog__requests__id"),
  S("/sla-governance"),
  S("/customers"), S(`/customers/${IDS.party}`, "customers__id"),
  S("/fraud-disputes"),
  S(`/fraud-disputes/fraud/${IDS.fraud_case}`, "fraud-disputes__fraud__id"),
  S(`/fraud-disputes/dispute/${IDS.dispute_case}`, "fraud-disputes__dispute__id"),
  S("/risk"),
  S("/analytics"), S("/analytics/comportamiento"),
  S("/casos-convertidos"),
  S("/evolucion"), S("/evolucion/mapa"),
  S("/projects"), S("/projects/new"), S(`/projects/${IDS.project}`, "projects__id"),
  S(`/projects/${IDS.project}/edit`, "projects__id__edit"), S("/projects/portafolio"),
  S("/problems"), S("/problems/new"), S(`/problems/${IDS.problem}`, "problems__id"),
  S(`/problems/${IDS.problem}/edit`, "problems__id__edit"),
  S("/changes"), S("/changes/new"), S(`/changes/${IDS.change_request}`, "changes__id"),
  S(`/changes/${IDS.change_request}/edit`, "changes__id__edit"),
  S("/squads"), S(`/squads/${IDS.squad}`, "squads__id"),
  S("/observability"), S("/dependencies"),
  S("/vendors"), S("/vendors/new"), S(`/vendors/${IDS.vendor}`, "vendors__id"),
  S(`/vendors/${IDS.vendor}/edit`, "vendors__id__edit"),
  S("/talent"), S(`/talent/${IDS.team_member}`, "talent__id"), S("/workload"), S("/delivery-areas"),
  S("/knowledge"), S(`/knowledge/${IDS.knowledge_article}`, "knowledge__id"), S("/knowledge/revision"),
  S("/ai-center"), S("/rules"),
  S("/workflows"), S(`/workflows/${IDS.workflow_instance}`, "workflows__id"),
  S(`/workflows/definitions/${IDS.workflow_definition}`, "workflows__definitions__id"),
  S("/processes"), S(`/processes/${IDS.process}`, "processes__id"),
  S("/admin"), S("/admin/sso-domains"),
  S("/catalog"), S(`/catalog/${IDS.catalog_key}`, "catalog__catalog"),
  S(`/catalog/${IDS.catalog_key}/new`, "catalog__catalog__new"),
  S("/cmdb"), S("/ledger"),
  S("/", "landing"), S("/start"), S("/unauthorized"),
];

// --- Rutas PROPIAS de cada persona (admin no las renderiza fielmente: dependen de datos del usuario) ---
const PERSONAS: Persona[] = [
  { name: "admin", state: "e2e/.auth/admin.json", themes: BOTH ? ["nexus", "claro"] : ["nexus"], shots: ADMIN_SHOTS },
  { name: "usuario", state: "e2e/.auth/usuario.json", themes: BOTH ? ["claro", "nexus"] : ["claro"], shots: [
    S("/portal", "portal__inicio"),
    S("/portal?tab=miscasos", "portal__miscasos"),
    { name: "portal__cases__id", path: "__RESOLVE_PORTAL_CASE__" },
    S("/knowledge", "portal__knowledge"),
    S("/service-catalog", "portal__service-catalog"),
  ] },
  { name: "operaciones", state: "e2e/.auth/operaciones.json", themes: BOTH ? ["nexus", "claro"] : ["nexus"], shots: [
    S("/operaciones", "operaciones__resumen"),
    S("/operaciones?tab=operacion", "operaciones__operacion"),
    S("/operaciones?tab=analitica", "operaciones__analitica"),
  ] },
  { name: "operador", state: "e2e/.auth/operador.json", themes: BOTH ? ["nexus", "claro"] : ["nexus"], shots: [
    S("/mi-dia"), S("/mis-casos"), S("/cola-equipo"), S("/mi-desempeno"), S("/notificaciones"),
  ] },
  { name: "evolucion", state: "e2e/.auth/evolucion.json", themes: BOTH ? ["nexus", "claro"] : ["nexus"], shots: [
    S("/evolucion", "evolucion__persona"), S("/projects/portafolio", "portafolio__persona"),
  ] },
  { name: "squads", state: "e2e/.auth/squads.json", themes: BOTH ? ["nexus", "claro"] : ["nexus"], shots: [
    S("/mi-trabajo"), S("/mi-squad"), S("/mis-iniciativas"), S("/mi-perfil"),
  ] },
];

async function applyTheme(page: Page, theme: Theme) {
  // Escribe el tema en el origin y recarga: el ThemeProvider lo lee de localStorage al montar.
  await page.evaluate((t) => localStorage.setItem("credix.theme", t), theme);
  await page.reload({ waitUntil: "load" }).catch(() => {});
}

async function settle(page: Page) {
  await page.waitForLoadState("load").catch(() => {});
  await page.locator("body").waitFor({ state: "visible" }).catch(() => {});
  await page.waitForTimeout(900); // deja render de charts/realtime antes del disparo
}

async function shoot(page: Page, theme: Theme, route: string, name: string) {
  await page.goto(route, { waitUntil: "load" }).catch(() => {});
  await applyTheme(page, theme);
  await settle(page);
  const out = path.join(process.cwd(), "e2e/screenshots", theme, `${name}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, fullPage: true });
  await expect(page.locator("body")).toBeVisible();
}

async function shootPortalCase(page: Page, theme: Theme) {
  await page.goto("/portal?tab=miscasos", { waitUntil: "load" }).catch(() => {});
  await applyTheme(page, theme);
  await settle(page);
  // El caso propio puede ser <a href="/portal/cases/..."> o una fila clicable; se intentan ambos.
  const link = page.locator('a[href*="/portal/cases/"]').first();
  if (await link.count()) {
    await link.click().catch(() => {});
  } else {
    await page.getByText(/INC-\d{4}-\d+/).first().click().catch(() => {});
  }
  await page.waitForURL(/\/portal\/cases\//, { timeout: 8000 }).catch(() => {});
  await settle(page);
  const out = path.join(process.cwd(), "e2e/screenshots", theme, "portal__cases__id.png");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, fullPage: true });
}

for (const persona of PERSONAS) {
  test.describe(`capturas · ${persona.name}`, () => {
    test.skip(!fs.existsSync(path.join(process.cwd(), persona.state)),
      `Sin sesion para ${persona.name} (falta ${persona.state}; define E2E_${persona.name.toUpperCase()}_EMAIL/PASSWORD)`);
    test.use({ storageState: persona.state });

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
