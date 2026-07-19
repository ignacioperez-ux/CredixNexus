import { defineConfig, devices } from "@playwright/test";

// E2E con Playwright. Foco: rol usuario (partner_user / Mi Portal), donde aparecieron mas errores.
// NO levanta el server (CLAUDE.md §3.1 #4 prohibe `npm run dev` desde Claude Code): usa el server que
// ya tiene el usuario arriba (reuseExistingServer). Antes de correr: `! npm run dev` en la terminal
// del usuario + `npx playwright install chromium` una vez.
//
// Credenciales de prueba por ENV (NUNCA hardcodear/commitear):
//   E2E_BASE_URL          (default http://localhost:3000)
//   E2E_PORTAL_EMAIL / E2E_PORTAL_PASSWORD   (usuario partner_user de prueba)
// Mutaciones (crear casos, enviar formularios) SOLO si E2E_ALLOW_MUTATIONS=1 (la BD es prod).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // 1) Login del usuario de prueba -> guarda storageState reutilizable.
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    // 2) Flujos del portal autenticados como partner_user.
    {
      name: "portal",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/portal.json" },
      testMatch: /portal\..*\.spec\.ts/,
    },
  ],
});
