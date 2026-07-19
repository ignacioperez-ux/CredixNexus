import { test, expect } from "@playwright/test";

// E2E del Miembro de Squad (squad_member): sus vistas /mi-* + segregacion (portafolio global vedado).

test.describe("Squad member (squad_member) · Mi trabajo y segregacion", () => {
  for (const route of ["/mi-trabajo", "/mi-squad", "/mis-iniciativas", "/mi-perfil"]) {
    test(`${route} carga sin error de runtime`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route));
      await expect(page.locator("body")).toBeVisible();
      expect(errors, `Errores de runtime: ${errors.join(" | ")}`).toHaveLength(0);
    });
  }

  test("segregacion: el portafolio global (/projects) esta vedado -> /unauthorized", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/unauthorized/);
  });
});
