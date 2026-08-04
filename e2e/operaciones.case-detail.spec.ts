import { test, expect } from "@playwright/test";

// E2E del detalle de caso SIMPLIFICADO (Gerente de Operaciones / support_lead). Verifica que, para
// cualquier caso, la pantalla queda en 2 zonas: (1) nucleo del caso arriba (titulo, asignacion, SLA)
// y (2) un bloque "Mas del caso" que agrupa lo secundario (Seguimiento / Vinculos / Transformacion-IA
// / Auditoria) colapsado. No depende de un id de caso concreto (abre el primero de la lista): cubre
// la simplificacion "para todos los casos". Sin mutaciones (BD real). Cubre §3.2 #8 del flujo tocado.

// i18n bilingue (el rol puede estar en ES o EN): se aceptan ambas variantes del copy.
const MORE = /M[áa]s del caso|More on this case/i;      // inc.more.title
const AUDIT = /^Auditor[íi]a$|^Audit$/i;                     // inc.group.audit (siempre presente: ledger)
const LEDGER = /ledger/i;                                     // inc.section.ledger (ES y EN contienen "(ledger)")

function watchErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return errors;
}

async function openFirstCase(page: import("@playwright/test").Page) {
  await page.goto("/incidents");
  await expect(page.locator("body")).toBeVisible();
  // Las filas son divs clickables con el numero de caso (INC-AAAA-NNNNNN); el click burbujea al div.
  const firstCase = page.getByText(/INC-\d{4}-\d+/).first();
  await expect(firstCase).toBeVisible();
  await firstCase.click();
  await page.waitForURL(/\/incidents\/[0-9a-fA-F-]{36}/);
}

test.describe("Operaciones · Detalle de caso simplificado", () => {
  test("abre un caso: nucleo arriba + bloque 'Mas del caso' con grupos, sin error de runtime", async ({ page }) => {
    const errors = watchErrors(page);
    await openFirstCase(page);

    // Zona 1 (nucleo, siempre visible): tarjeta SLA en el rail derecho.
    await expect(page.getByText("SLA", { exact: true }).first()).toBeVisible();

    // Zona 2: encabezado del bloque secundario + al menos el grupo Auditoria (ledger siempre existe).
    await expect(page.getByText(MORE).first()).toBeVisible();
    await expect(page.getByText(AUDIT).first()).toBeVisible();

    expect(errors, `Errores de runtime: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("'Mas del caso': el modulo de Auditoria (ledger) colapsa/expande", async ({ page }) => {
    const errors = watchErrors(page);
    await openFirstCase(page);

    const ledgerHeader = page.getByRole("button", { name: LEDGER }).first();
    await expect(ledgerHeader).toBeVisible();
    // Colapsado por defecto -> al abrir, aria-expanded pasa a true.
    await ledgerHeader.click();
    await expect(ledgerHeader).toHaveAttribute("aria-expanded", "true");
    // Y vuelve a cerrar.
    await ledgerHeader.click();
    await expect(ledgerHeader).toHaveAttribute("aria-expanded", "false");

    expect(errors, `Errores de runtime: ${errors.join(" | ")}`).toHaveLength(0);
  });
});
