import { test, expect } from "@playwright/test";

/* ============================================================================
 * Smoke del Design System oficial de Credix (SIN credenciales).
 * Valida en la landing/login publica:
 *   - Heebo aplicada (fuente oficial del DS)
 *   - acento de marca = rojo Credix #E42313 (rgb 228,35,19)
 *   - ausencia del rojo anterior #E4002B (rgb 228,0,43)
 *   - ausencia de morado (ejemplos genericos Material del .fig)
 * y captura screenshots responsive (desktop/tablet/movil).
 * No requiere ENV de credenciales: cubre la puerta de entrada (relevante para el SSO).
 * ========================================================================== */

const shots = "design-system/generated/screenshots";

test.describe("Credix DS — identidad visual (landing)", () => {
  test("Heebo + rojo #E42313 + sin morado + screenshots", async ({ page }) => {
    await page.goto("/");

    // 1) Heebo como fuente base de la UI.
    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont.toLowerCase()).toContain("heebo");

    // 2) CTA primaria de login = rojo Credix oficial #E42313.
    const submit = page.locator('#login button[type="submit"]');
    await expect(submit).toBeVisible();
    const btnBg = await submit.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(btnBg.replace(/\s/g, "")).toBe("rgb(228,35,19)");

    // 3) No debe quedar el rojo anterior ni morado en NINGUN color/fondo/borde renderizado.
    const offenders = await page.evaluate(() => {
      const bad = { oldRed: 0, purple: 0 };
      const isPurple = (r: number, g: number, b: number) => r > 90 && b > 140 && g < r * 0.7 && g < b * 0.7;
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const s = getComputedStyle(el);
        for (const prop of ["color", "backgroundColor", "borderTopColor", "borderBottomColor"]) {
          const v = s.getPropertyValue(prop);
          const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (!m) continue;
          const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
          if (r === 228 && g === 0 && b === 43) bad.oldRed++;
          if (isPurple(r, g, b)) bad.purple++;
        }
      }
      return bad;
    });
    expect(offenders.oldRed, "rojo anterior #E4002B no debe aparecer").toBe(0);
    expect(offenders.purple, "no debe haber morado de ejemplos Material").toBe(0);

    // 3b) Tema Claro = esquema Baseline oficial: los tokens deben resolver por la cadena
    //     curada -> semantica -> primitiva a los valores del DS. Valida el retint real.
    const claro = await page.evaluate(() => {
      document.documentElement.dataset.theme = "claro";
      const cs = getComputedStyle(document.documentElement);
      const read = (v: string) => {
        const el = document.createElement("div");
        el.style.color = v;
        document.body.appendChild(el);
        const out = getComputedStyle(el).color;
        el.remove();
        return out;
      };
      return {
        bg: read(cs.getPropertyValue("--bg").trim()),
        card: read(cs.getPropertyValue("--card").trim()),
        line: read(cs.getPropertyValue("--line").trim()),
        text: read(cs.getPropertyValue("--text").trim()),
        accent: read(cs.getPropertyValue("--accent").trim()),
      };
    });
    expect(claro.bg).toBe("rgb(247, 250, 252)"); // surface #F7FAFC
    expect(claro.card).toBe("rgb(255, 255, 255)"); // surface lowest #FFFFFF
    expect(claro.line).toBe("rgb(195, 199, 201)"); // outline variant #C3C7C9
    expect(claro.text).toBe("rgb(24, 28, 30)"); // on surface #181C1E
    expect(claro.accent).toBe("rgb(228, 35, 19)"); // primary #E42313
    await page.evaluate(() => { document.documentElement.dataset.theme = "nexus"; });

    // 4) Screenshots responsive (Fase 9).
    for (const [name, w, h] of [
      ["desktop-1440", 1440, 900],
      ["tablet-768", 768, 1024],
      ["mobile-390", 390, 844],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${shots}/landing-${name}.png`, fullPage: false });
    }
  });
});
