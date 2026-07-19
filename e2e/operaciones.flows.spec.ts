import { test, expect } from "@playwright/test";

// E2E del Gerente de Operaciones (support_lead): Torre de Control UNIFICADA (hero + decision + KPIs +
// tabs Resumen/Colas/Carga/SLA/Aging) y el redirect de /dashboard -> /operaciones para este rol.

test.describe("Operaciones (support_lead) · Torre de Control", () => {
  test("la Torre carga con hero, KPIs y tabs, sin error de runtime", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await page.goto("/operaciones");
    await expect(page).toHaveURL(/\/operaciones/);
    await expect(page.locator("body")).toBeVisible();
    for (const label of [/^resumen$|^summary$/i, /^colas$|^queues$/i, /^carga$|^load$/i, /^aging$/i]) {
      await expect(page.getByRole("button", { name: label }).first()).toBeVisible();
    }
    expect(errors, `Errores de runtime: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("navegar los tabs de la Torre (?tab=) no rompe", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });
    for (const tab of ["colas", "carga", "sla", "aging"]) {
      await page.goto(`/operaciones?tab=${tab}`);
      await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
      await expect(page.locator("body")).toBeVisible();
    }
    expect(errors, `Errores de runtime: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("/dashboard redirige a /operaciones (vista unificada del rol)", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/operaciones/);
  });
});
