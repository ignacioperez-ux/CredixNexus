# Kit de capturas de pantalla — Credix Nexus

Genera un PNG de página completa por cada una de las 85 pantallas, para alimentar el **Manual de
Pantallas** (y las capturas anotadas del Manual de Usuario). Reusa el arnés Playwright del repo.

## Qué se generó

| Archivo | Rol |
|---|---|
| `e2e/screenshots.capture.spec.ts` | Spec que recorre las rutas por persona y tema y dispara los screenshots. |
| `e2e/screenshots/sample-ids.json` | Ids reales de muestra (tenant CREDIX) para las pantallas de detalle `[id]`. |
| `e2e/auth.setup.ts` | +persona **admin** (login que produce `e2e/.auth/admin.json`). |
| `playwright.config.ts` | +proyecto **screenshots** (serial, depende de `setup`). |

Salida de las imágenes: **`e2e/screenshots/<tema>/<archivo>.png`** (p. ej.
`e2e/screenshots/nexus/incidents__id.png`). Las imágenes están en `.gitignore` (no se versionan);
`sample-ids.json` sí se versiona.

## Cómo correrlo

Requisitos: el server que levanta el usuario (§3.1 #4 impide que lo levante el asistente) y las
credenciales por ENV (nunca en el repo).

```bash
# 1) En tu terminal, deja el server arriba en el puerto de E2E (default 3100):
! npm run dev -- --port 3100        # o exporta E2E_BASE_URL=http://localhost:3000 y usa tu 3000

# 2) Una vez (si no lo hiciste): navegador de Playwright
npx playwright install chromium

# 3) Credenciales de las personas a capturar (las que falten, se saltean):
export E2E_ADMIN_EMAIL=ignacio.perez@tiicr.com   E2E_ADMIN_PASSWORD=...
export E2E_USUARIO_EMAIL=usuario@credix.local     E2E_USUARIO_PASSWORD=...
export E2E_OPERACIONES_EMAIL=operaciones@credix.local E2E_OPERACIONES_PASSWORD=...
export E2E_OPERADOR_EMAIL=operador@credix.local   E2E_OPERADOR_PASSWORD=...
export E2E_EVOLUCION_EMAIL=evolucion@credix.local E2E_EVOLUCION_PASSWORD=...
export E2E_SQUADS_EMAIL=squads@credix.local       E2E_SQUADS_PASSWORD=...

# 4) Correr SOLO el proyecto de capturas:
npx playwright test --project=screenshots

# (opcional) Capturar AMBOS temas (Nexus oscuro + Claro) para todas las personas:
CAPTURE_THEMES=both npx playwright test --project=screenshots
```

Por defecto se captura **1 tema por persona** (Nexus para staff; **Claro** para el Usuario final,
que es su tema por defecto). `CAPTURE_THEMES=both` captura los dos para todo (~2×).

## Cobertura (qué persona captura qué)

El grueso de las pantallas se captura con **admin** (ve todo, sin denylist). Las pantallas propias de
cada persona (que admin no renderiza con datos reales) se capturan con esa persona.

### admin — pantallas globales / staff (68)
`/dashboard` · `/workspace` · `/incidents` · `/incidents/new` · `/incidents/[id]` ·
`/incidents/[id]/edit` · `/triage` · `/major-incidents` · `/major-incidents/[id]` ·
`/service-catalog` · `/service-catalog/requests/[id]` · `/sla-governance` · `/customers` ·
`/customers/[id]` · `/fraud-disputes` · `/fraud-disputes/fraud/[id]` · `/fraud-disputes/dispute/[id]` ·
`/risk` · `/analytics` · `/analytics/comportamiento` · `/casos-convertidos` · `/evolucion` ·
`/evolucion/mapa` · `/projects` · `/projects/new` · `/projects/[id]` · `/projects/[id]/edit` ·
`/projects/portafolio` · `/problems` · `/problems/new` · `/problems/[id]` · `/problems/[id]/edit` ·
`/changes` · `/changes/new` · `/changes/[id]` · `/changes/[id]/edit` · `/squads` · `/squads/[id]` ·
`/observability` · `/dependencies` · `/vendors` · `/vendors/new` · `/vendors/[id]` ·
`/vendors/[id]/edit` · `/talent` · `/talent/[id]` · `/workload` · `/delivery-areas` · `/knowledge` ·
`/knowledge/[id]` · `/knowledge/revision` · `/ai-center` · `/rules` · `/workflows` · `/workflows/[id]` ·
`/workflows/definitions/[id]` · `/processes` · `/processes/[id]` · `/admin` · `/admin/sso-domains` ·
`/catalog` · `/catalog/[catalog]` · `/catalog/[catalog]/new` · `/cmdb` · `/ledger` · `/` (landing) ·
`/start` · `/unauthorized`

### usuario (partner_user) — portal, tema Claro (5)
`/portal` (inicio) · `/portal?tab=miscasos` · `/portal/cases/[id]` (resuelto en runtime) ·
`/knowledge` (vista usuario) · `/service-catalog` (vista usuario)

### operaciones (support_lead) — Torre de Control (3)
`/operaciones` (Resumen) · `?tab=operacion` · `?tab=analitica`

### operador (support_agent) — su día (5)
`/mi-dia` · `/mis-casos` · `/cola-equipo` · `/mi-desempeno` · `/notificaciones`

### evolucion (product_owner) — persona Evolución (2)
`/evolucion` (nav de persona) · `/projects/portafolio`

### squads (squad_member) — Mi trabajo (4)
`/mi-trabajo` · `/mi-squad` · `/mis-iniciativas` · `/mi-perfil`

**Total:** 87 capturas por tema (algunas rutas se capturan en más de una persona a propósito, para
mostrar la experiencia del rol: p. ej. `/operaciones` y `/evolucion` con su overlay de navegación).

## Notas y mantenimiento

- **Detalle `[id]`:** usa ids reales de `sample-ids.json`. Si un id deja de existir (dato borrado),
  regenéralo con `select id from <tabla> limit 1` y actualiza el JSON. El caso del portal se resuelve
  en runtime abriendo "Mis casos" y clicando el primero (pertenece al usuario final).
- **Formularios `/new` y `/[id]/edit`:** se capturan vacíos/precargados (útil para el manual de
  pantallas). No envían datos (sin mutaciones).
- **Nombre de archivo:** la ruta con `/` y `[` → `__` (p. ej. `/incidents/[id]` → `incidents__id.png`).
  Coincide con la convención sugerida para subir las capturas a Claude Design.
- **Estabilización:** cada captura espera `load` + 900 ms para dar tiempo a charts/realtime. Si alguna
  pantalla pesada sale a medio render, subir ese margen en `settle()`.
- **Fallos aislados:** cada ruta es un test independiente; si una falla (p. ej. un id inexistente), el
  resto se captura igual. Revisa el reporte HTML de Playwright para ver cuáles fallaron.
