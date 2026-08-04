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

## Dónde se corre (importante)

Este kit hace peticiones HTTP al server de la app. **Debe correrse en la máquina donde está corriendo
el server** (tu equipo local). Una sesión de Claude Code *en la web / remota* corre en un contenedor
aislado que **no alcanza tu `localhost:3000`** ni tu red LAN, así que las capturas **las ejecutas tú**
en tu terminal, sobre esta rama.

## Cómo correrlo

Requisitos: tu server arriba (§3.1 #4 impide que lo levante el asistente) y credenciales por ENV.

```bash
# 0) Sitúate en esta rama y con el server arriba (el tuyo en :3000):
git pull && git checkout claude/user-operations-review-n14npu

# 1) Navegador de Playwright (una vez):
npx playwright install chromium

# 2) Apunta al server que YA tienes en :3000 y define credenciales (mismo password para las 5):
export E2E_BASE_URL=http://localhost:3000
export E2E_USUARIO_EMAIL=usuario@credix.local          E2E_USUARIO_PASSWORD=prueba
export E2E_OPERACIONES_EMAIL=operaciones@credix.local  E2E_OPERACIONES_PASSWORD=prueba
export E2E_OPERADOR_EMAIL=operador@credix.local        E2E_OPERADOR_PASSWORD=prueba
export E2E_EVOLUCION_EMAIL=evolucion@credix.local      E2E_EVOLUCION_PASSWORD=prueba
export E2E_SQUADS_EMAIL=squads@credix.local            E2E_SQUADS_PASSWORD=prueba
# (opcional, para las 9 pantallas solo-admin) export E2E_ADMIN_EMAIL=ignacio.perez@tiicr.com E2E_ADMIN_PASSWORD=...

# 3) Correr SOLO el proyecto de capturas:
npx playwright test --project=screenshots

# (opcional) Ambos temas (Nexus oscuro + Claro) para todo (~2×):
CAPTURE_THEMES=both npx playwright test --project=screenshots
```

Por defecto se captura **1 tema por persona** (Nexus para staff; **Claro** para el Usuario final,
que es su tema por defecto). Las imágenes quedan en `e2e/screenshots/<tema>/`.

## Cobertura (qué cuenta captura qué)

La asignación se hizo por **permisos reales** (verificados en BD), para que ninguna captura caiga en
`/unauthorized`. `operaciones@` es **multi-rol** (`support_lead` + `responsable_comercial`) → recibe la
navegación completa y captura el grueso staff. Las pantallas que exigen permisos de admin
(`user.manage`, `masterdata.manage`, `cmdb.read`→ok operador, `audit.read`, `risk.read`,
`problem.manage`) se cubren con otra cuenta o quedan como **solo-admin**.

### operaciones@ — grueso staff (~54)
Inicio, incidencias (lista/nueva/detalle/editar), triage, incidentes mayores (+detalle), catálogo de
servicios (+solicitud), gobierno SLA, clientes (+detalle), fraude/disputas (+detalles), analítica
(+comportamiento), casos convertidos, Torre de Operaciones (3 pestañas), evolución (+mapa), proyectos
(lista/nuevo/detalle/editar/portafolio), problemas (lista/detalle), cambios (lista/nuevo/detalle/
editar), squads (+detalle), observabilidad, proveedores (lista/detalle), talento (+detalle), carga,
áreas, revisión KB, centro de IA, workflows (+instancia/definición), procesos (+detalle), `/start`,
`/unauthorized`.

### evolucion@ — reglas/conocimiento/vendors-edit + persona (7)
`/rules` · `/knowledge` · `/knowledge/[id]` · `/vendors/new` · `/vendors/[id]/edit` ·
`/evolucion` (overlay de persona) · `/projects/portafolio` (persona).

### operador@ — CMDB/dependencias + su día (7)
`/cmdb` · `/dependencies` · `/mi-dia` · `/mis-casos` · `/cola-equipo` · `/mi-desempeno` ·
`/notificaciones`.

### usuario@ — portal, tema Claro (5)
`/portal` · `/portal?tab=miscasos` · `/portal/cases/[id]` (runtime) · `/knowledge` (vista usuario) ·
`/service-catalog` (vista usuario).

### squads@ — Mi trabajo (4)
`/mi-trabajo` · `/mi-squad` · `/mis-iniciativas` · `/mi-perfil`.

### anon (sin sesión) — públicas (2)
`/` (landing) · `/login`.

### admin — SOLO-ADMIN (9, se saltan sin `E2E_ADMIN_*`)
`/risk` · `/admin` · `/admin/sso-domains` · `/catalog` · `/catalog/[catalog]` ·
`/catalog/[catalog]/new` · `/ledger` · `/problems/new` · `/problems/[id]/edit`.

**Total:** ~88 capturas por tema. Sin la cuenta admin se obtienen ~79; las 9 solo-admin requieren
`E2E_ADMIN_EMAIL/PASSWORD`.

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
