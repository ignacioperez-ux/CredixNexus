import { defineConfig, devices } from "@playwright/test";

// E2E con Playwright. Foco: rol usuario (partner_user / Mi Portal), donde aparecieron mas errores.
// NO levanta el server (CLAUDE.md §3.1 #4 prohibe `npm run dev` desde Claude Code): usa el server que
// ya tiene el usuario arriba (reuseExistingServer). Antes de correr: `! npm run dev` en la terminal
// del usuario + `npx playwright install chromium` una vez.
//
// Credenciales de prueba por ENV (NUNCA hardcodear/commitear):
//   E2E_BASE_URL              (default http://localhost:3000)
//   E2E_USUARIO_EMAIL / E2E_USUARIO_PASSWORD       (partner_user / Mi Portal)
//   E2E_EVOLUCION_EMAIL / E2E_EVOLUCION_PASSWORD   (product_owner / Gerente de Evolucion)
// Mutaciones (crear casos, enviar formularios) SOLO si E2E_ALLOW_MUTATIONS=1 (la BD es prod).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 1,
  // El dev server (turbopack + HMR) se satura con mucha concurrencia: pocos workers + timeouts amplios.
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // 1) Login del usuario de prueba -> guarda storageState reutilizable.
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    // 2) Flujos del portal (partner_user / Mi Portal).
    {
      name: "portal",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/usuario.json" },
      testMatch: /portal\..*\.spec\.ts/,
    },
    // 3) Gerente de Operaciones (support_lead): Torre de Control unificada.
    {
      name: "operaciones",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/operaciones.json" },
      testMatch: /operaciones\..*\.spec\.ts/,
    },
    // 4) Operador (support_agent): Mi dia / Mis casos / cola.
    {
      name: "operador",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/operador.json" },
      testMatch: /operador\..*\.spec\.ts/,
    },
    // 5) Gerente de Evolucion (product_owner): home + Kanban de proyectos.
    {
      name: "evolucion",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/evolucion.json" },
      testMatch: /evolucion\..*\.spec\.ts/,
    },
    // 6) Miembro de Squad (squad_member): Mi trabajo / Mi squad / Mis iniciativas.
    {
      name: "squads",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/squads.json" },
      testMatch: /squads\..*\.spec\.ts/,
    },
  ],
});
