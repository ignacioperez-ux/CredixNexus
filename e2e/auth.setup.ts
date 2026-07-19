import { test as setup } from "@playwright/test";

// Login por PERSONA -> storageState reutilizable. Credenciales por ENV (nunca en el repo).
// Cada persona se saltea si faltan sus credenciales. Foco: usuario (Mi Portal), pero se cubren
// tambien las personas internas para E2E exhaustivo (regla §3.2 #8).
const PERSONAS = [
  { name: "usuario",     email: process.env.E2E_USUARIO_EMAIL,     password: process.env.E2E_USUARIO_PASSWORD,     state: "e2e/.auth/usuario.json" },
  { name: "operaciones", email: process.env.E2E_OPERACIONES_EMAIL, password: process.env.E2E_OPERACIONES_PASSWORD, state: "e2e/.auth/operaciones.json" },
  { name: "operador",    email: process.env.E2E_OPERADOR_EMAIL,    password: process.env.E2E_OPERADOR_PASSWORD,    state: "e2e/.auth/operador.json" },
  { name: "evolucion",   email: process.env.E2E_EVOLUCION_EMAIL,   password: process.env.E2E_EVOLUCION_PASSWORD,   state: "e2e/.auth/evolucion.json" },
  { name: "squads",      email: process.env.E2E_SQUADS_EMAIL,      password: process.env.E2E_SQUADS_PASSWORD,      state: "e2e/.auth/squads.json" },
];

for (const p of PERSONAS) {
  setup(`login ${p.name}`, async ({ page }) => {
    setup.skip(!p.email || !p.password, `Sin credenciales E2E para ${p.name} (E2E_${p.name.toUpperCase()}_EMAIL/PASSWORD)`);
    await page.goto("/login");
    await page.locator("#email").fill(p.email!);
    await page.locator("#password").fill(p.password!);
    await page.getByRole("button", { name: /^ingresar$|^sign in$/i }).click();
    // Basta con salir de /login (cada rol cae en su home): capturamos el storageState.
    // Timeout amplio: el dev server puede recompilar la home del rol en la primera visita.
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
    await page.context().storageState({ path: p.state });
  });
}
