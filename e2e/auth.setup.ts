import { test as setup, expect } from "@playwright/test";

// Autentica un usuario partner_user de prueba y guarda el storageState para los specs del portal.
// Credenciales por ENV (nunca en el repo). Si faltan, el setup falla con un mensaje claro.
const EMAIL = process.env.E2E_PORTAL_EMAIL;
const PASSWORD = process.env.E2E_PORTAL_PASSWORD;

setup("login partner_user", async ({ page }) => {
  expect(EMAIL, "Falta E2E_PORTAL_EMAIL (usuario partner_user de prueba)").toBeTruthy();
  expect(PASSWORD, "Falta E2E_PORTAL_PASSWORD").toBeTruthy();

  await page.goto("/login");
  await page.getByLabel(/correo|email/i).fill(EMAIL!);
  await page.getByLabel(/contrase|password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /ingresar|sign in/i }).click();

  // Tras login, el usuario final cae en su portal (start -> /portal).
  await page.waitForURL(/\/(portal|start)/, { timeout: 15_000 });
  await page.context().storageState({ path: "e2e/.auth/portal.json" });
});
