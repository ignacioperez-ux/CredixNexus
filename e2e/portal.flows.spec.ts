import { test, expect } from "@playwright/test";

// E2E exhaustivo del rol usuario (partner_user / Mi Portal). Autenticado via storageState (auth.setup).
// Por defecto NO muta datos (la BD es prod); los flujos que crean casos van detras de E2E_ALLOW_MUTATIONS.
const ALLOW_MUTATIONS = process.env.E2E_ALLOW_MUTATIONS === "1";

test.describe("Mi Portal · navegacion y estados", () => {
  test("el portal carga y muestra el hub", async ({ page }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal/);
    // El shell del portal (header + contenido) debe renderizar sin error.
    await expect(page.locator("body")).toBeVisible();
  });

  test("navega por las pestanas del hub (inicio/autoservicio/miscasos/registrar)", async ({ page }) => {
    for (const tab of ["inicio", "autoservicio", "miscasos", "registrar"]) {
      await page.goto(tab === "inicio" ? "/portal" : `/portal?tab=${tab}`);
      await expect(page).toHaveURL(new RegExp(tab === "inicio" ? "/portal" : `tab=${tab}`));
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("registrar: al salir de la pestana y volver, el intake queda limpio (regresion)", async ({ page }) => {
    await page.goto("/portal?tab=registrar");
    const subject = page.getByPlaceholder(/describe|placeholder|search/i).first();
    await subject.fill("Necesito acceso al sistema core de prueba e2e");
    await expect(subject).toHaveValue(/acceso/);

    // Salir a otra pestana y volver -> el textarea debe quedar vacio (fix del reset del intake).
    await page.goto("/portal?tab=miscasos");
    await page.goto("/portal?tab=registrar");
    await expect(page.getByPlaceholder(/describe|placeholder|search/i).first()).toHaveValue("");
  });

  test("toggle de tema: la opcion oscuro (Nexus) esta y cambia el tema", async ({ page }) => {
    await page.goto("/portal");
    const nexusBtn = page.getByRole("button", { name: /^nexus$/i });
    await expect(nexusBtn).toBeVisible();
    await nexusBtn.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "nexus");
    const claroBtn = page.getByRole("button", { name: /^claro|^light$/i });
    await claroBtn.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "claro");
  });

  test("Conocimiento (KB) carga", async ({ page }) => {
    await page.goto("/knowledge");
    await expect(page).toHaveURL(/\/knowledge/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("Catalogo de servicios carga", async ({ page }) => {
    await page.goto("/service-catalog");
    await expect(page).toHaveURL(/\/service-catalog/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("ninguna pantalla del portal muestra error de runtime", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const path of ["/portal", "/portal?tab=autoservicio", "/portal?tab=miscasos", "/portal?tab=registrar", "/knowledge", "/service-catalog"]) {
      await page.goto(path);
      await expect(page.locator("body")).toBeVisible();
    }
    expect(errors, `Errores de runtime: ${errors.join(" | ")}`).toHaveLength(0);
  });
});

test.describe("Mi Portal · mutaciones (solo con E2E_ALLOW_MUTATIONS=1)", () => {
  test.skip(!ALLOW_MUTATIONS, "Muta datos en prod; habilitar con E2E_ALLOW_MUTATIONS=1");

  test("registrar un caso y ver el mensaje de exito", async ({ page }) => {
    await page.goto("/portal?tab=registrar");
    await page.getByPlaceholder(/describe|placeholder|search/i).first().fill("Caso de prueba E2E (ignorar) - acceso");
    // Elegir una categoria (el primer select con opciones de categoria).
    const cat = page.locator("select").filter({ hasText: /categor|elegi|choose/i }).first();
    await cat.selectOption({ index: 1 });
    await page.getByRole("button", { name: /registrar caso|register/i }).click();
    await expect(page.getByText(/INC-\d{4}-\d+/)).toBeVisible({ timeout: 15_000 });
  });
});
