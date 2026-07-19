import { test, expect } from "@playwright/test";

// E2E del Gerente de Evolucion (product_owner). Cubre el "Kanban de Evolucion" (/projects) que el
// usuario reporto como problematico, para protegerlo contra regresiones. Autenticado via storageState.

// Tarjeta de proyecto = link a /projects/{uuid}. Se excluyen los links de navegacion del tablero
// (Portafolio /projects/portafolio y Nuevo proyecto /projects/new), que NO son tarjetas.
const CARD = 'a[href^="/projects/"]:not([href="/projects/portafolio"]):not([href="/projects/new"])';

test.describe("Evolucion (product_owner) · home y Kanban", () => {
  test("la home de Evolucion carga sin error de runtime", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/evolucion");
    await expect(page).toHaveURL(/\/evolucion/);
    await expect(page.locator("body")).toBeVisible();
    expect(errors, `Errores de runtime: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("el Kanban de proyectos carga, muestra tarjetas y no rompe", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });

    await page.goto("/projects");
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.locator("body")).toBeVisible();

    // El tablero debe mostrar tarjetas de proyecto reales. No debe quedar vacio/roto.
    expect(await page.locator(CARD).count(), "el tablero deberia mostrar tarjetas de proyecto").toBeGreaterThan(0);

    expect(errors, `Errores de runtime: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("Kanban: alternar orden WSJF/ROI no rompe el tablero", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("button", { name: /^ROI$/i }).click();
    await expect(page.locator(CARD).first()).toBeVisible();
    await page.getByRole("button", { name: /^WSJF$/i }).click();
    await expect(page.locator(CARD).first()).toBeVisible();
  });

  test("abrir el detalle de un proyecto desde una tarjeta del Kanban", async ({ page }) => {
    await page.goto("/projects");
    // Determinista: tomamos el href de una tarjeta real (termina en UUID), no un link de nav.
    const hrefs = await page.locator('a[href^="/projects/"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute("href")).filter((h): h is string => !!h && /\/projects\/[0-9a-f-]{20,}$/.test(h)));
    expect(hrefs.length, "el tablero deberia tener al menos una tarjeta de proyecto").toBeGreaterThan(0);
    await page.locator(`a[href="${hrefs[0]}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(hrefs[0].replace(/\//g, "\\/") + "$"));
    await expect(page.locator("body")).toBeVisible();
  });
});
