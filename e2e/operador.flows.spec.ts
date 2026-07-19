import { test, expect } from "@playwright/test";

// E2E del Operador (support_agent): su cockpit "Mi dia" + segregacion dura (rutas de gestion vedadas).

test.describe("Operador (support_agent) · Mi dia y segregacion", () => {
  test("Mi dia (estilo Torre) carga con tabs, sin error de runtime", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await page.goto("/mi-dia");
    await expect(page).toHaveURL(/\/mi-dia/);
    await expect(page.locator("body")).toBeVisible();
    // Tabs del cockpit personal (Resumen / SLA y prioridad / Mi semana).
    for (const label of [/^resumen$|^summary$/i, /sla/i, /semana|week/i]) {
      await expect(page.getByRole("button", { name: label }).first()).toBeVisible();
    }
    expect(errors, `Errores de runtime: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("Mi dia: navegar los tabs (?tab=) no rompe", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const tab of ["sla", "semana"]) {
      await page.goto(`/mi-dia?tab=${tab}`);
      await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
      await expect(page.locator("body")).toBeVisible();
    }
    expect(errors, `Errores de runtime: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("segregacion: una ruta de gestion vedada (/dashboard) redirige a /unauthorized", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("puede abrir Conocimiento (KB) y el catalogo (solicitante)", async ({ page }) => {
    await page.goto("/knowledge");
    await expect(page).toHaveURL(/\/knowledge/);
    await expect(page.locator("body")).toBeVisible();
    await page.goto("/service-catalog");
    await expect(page).toHaveURL(/\/service-catalog/);
    await expect(page.locator("body")).toBeVisible();
  });
});
