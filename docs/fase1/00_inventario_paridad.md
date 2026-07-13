# Sub-Fase 1.0 — Inventario y línea base · Experiencia rol **Usuario**

> **Modo:** Arquitecto (análisis, solo lectura — cero cambios de código de producción).
> **Alcance:** exclusivamente la experiencia del rol Usuario. Fuente de verdad: el **código del repositorio** y el **esquema vivo de Supabase** (§2.6), no el diagnóstico visual del encargo.
> **Fecha:** 2026-07-13 · **Rama:** main.
> **Disciplina:** cada afirmación se marca **HECHO** (verificado en código/BD), **INTERPRETACIÓN** (inferencia razonada) o **HIPÓTESIS** (supuesto sin evidencia).

---

## 1. Stack real encontrado (HECHO)

| Capa | Realidad verificada | Evidencia |
|---|---|---|
| Framework | **Next.js 16.2** (App Router, Server Components + Server Actions) | `package.json:17` |
| UI | **React 19** | `package.json:18-19` |
| Lenguaje | **TypeScript 5.7** | `package.json:31` |
| Estilos | **Tailwind CSS v4** + **design system propio** por CSS custom properties | `package.json:29`, `app/globals.css:1` |
| Datos/Auth | **Supabase** (`@supabase/ssr` 0.7, `supabase-js` 2.110) — Postgres 17, RLS, Auth | `package.json:15-16` |
| Iconografía | **SVG inline propio** estilo Lucide (sin dependencia externa) | `components/ui/icon.tsx:6-53` |
| i18n | **Diccionario propio ES/EN** (`useI18n`, claves tipadas) | `lib/i18n/dictionaries.ts`, `lib/i18n/provider.tsx` |
| Temas | **2 temas conmutables** por `data-theme` en `<html>` (Nexus / Claro), persistido en `localStorage` | `components/theme-provider.tsx:6,16,28` |
| Tests | **Vitest 4** | `package.json:31` |

> **UX-desviación vs. encargo:** el brief menciona **Radix UI**. **NO existe** en `package.json` (HECHO). El sistema de componentes es propio (SVG + CSS vars). No es bloqueante, pero invalida cualquier supuesto de diseño basado en primitivas Radix.

---

## 2. Modelo de acceso del rol Usuario (HECHO — verificado en BD viva)

El rol Usuario es **`partner_user`** (tabla `role`, `tenant_id IS NULL`, global). Confirmado el 2026-07-13 contra la BD `dffbysjrvvlwgzgakhaa`:

**Permisos vivos de `partner_user` (6):**
`incident.create` · `knowledge.read` · `knowledge.feedback` · `service_catalog.read` · `service_catalog.request` · `survey.submit`

**NO tiene:** `incident.read`, `incident.update`, `service_catalog.manage`, `change.*`, `rule.*`, `project.*`, `problem.*` ni ningún permiso de operación/administración.

> **UX-desviación crítica de método (HECHO):** la **migración** `sql/0070_partner_user_perms.sql` concede solo **3** permisos (`incident.create`, `knowledge.read`, `knowledge.feedback`) y comenta explícitamente que NO se da `incident.read`. Pero la **BD viva** tiene **6** — los otros 3 provienen de migraciones posteriores: `sql/0063_service_catalog.sql:95-96` (`service_catalog.read`, `service_catalog.request`) y `sql/0055_case_survey.sql:54` (`survey.submit`). **Confirma la regla §2.6:** el esquema vivo manda; leer solo migraciones habría subestimado el alcance. `partner_admin` tiene **CERO** permisos en vivo → rol inerte.

**Enrutamiento por rol (HECHO):**
- Home efectivo del `partner_user` → **`/portal`** (`lib/nav/role-ux.ts:58` `home:"/portal"`; `resolveHome` en `role-ux.ts:85-89`; fallback `defaultHome` en `lib/nav/access.ts:57-62`).
- Acción primaria (CTA del header) → **`reportCase`** → `/portal`, ícono `plus` (`role-ux.ts:32,58,93-102`).
- Categorías del sidebar auto-expandidas → `tickets`, `conocimiento` (`role-ux.ts:58`).

**RLS (HECHO — verificado en `pg_policies`):** `incident`, `service_request` y `case_survey` tienen **una sola policy de aislamiento por tenant** (`tenant_id = current_tenant_id()`, `cmd=ALL`). **No hay** restricción a "filas propias" a nivel de BD. `case_survey` usa rol `{public}`; los otros `{authenticated}` (inconsistencia menor). Implicación: el auto-scope "mis casos" es **solo a nivel de aplicación**; la RLS por sí sola permitiría a un `partner_user` leer cualquier fila del tenant si tuviera ruta para ello → ver UX-002/UX-003.

---

## 3. Superficies REALES del Usuario y reconciliación con las 8 áreas del encargo

El encargo enumera 8 "pantallas actuales". La realidad del código es **más consolidada** y en parte **inaccesible** al rol. Reconciliación (HECHO salvo lo marcado):

| # | Área nominal (encargo) | Realidad en código para `partner_user` | Ruta / archivo | ¿Accesible? |
|---|---|---|---|---|
| 1 | **Inicio de Mi Portal** | Página consolidada: hero, categorías, intake, sugerencias IA, "Mis casos". **Es la pantalla central y casi única del rol.** | `/portal` → `components/portal/portal.tsx` | ✅ Sí (ruta libre) |
| 2 | **Catálogo de Servicios** | Tab "Catálogo" (grid por categoría con SLA). **Compartida** con agente/admin. | `/service-catalog` → `components/catalog/catalog-grid.tsx` | ✅ Sí (`service_catalog.read`) |
| 3 | **Formulario de solicitud** | (a) Intake del portal (asunto/app/categoría/urgencia). (b) `RequestForm` dinámico del catálogo (`form_schema`). | `portal.tsx` intake · `components/catalog/request-form.tsx` | ✅ Sí (`incident.create` / `service_catalog.request`) |
| 4 | **Mis Casos** | **TRES superficies con scoping distinto:** "Mis casos" del portal (`reported_by_user_id`); "Mis solicitudes" del catálogo (**tenant-wide**, no propias — UX-002); "Mis tickets" del `/partner` (`affected_party_id`). | `portal.tsx` · `components/catalog/request-list.tsx` · `components/partner/partner-portal.tsx` | ✅ parcial / ⚠️ inconsistente |
| 5 | **Detalle de caso** | **NO accesible.** El detalle de incidente `/incidents/[id]` exige `incident.read`. El usuario **no puede abrir/seguir** su caso. Único "detalle" alcanzable: detalle de **solicitud** de catálogo. | `/incidents/[id]` (bloqueado) · `/service-catalog/requests/[id]` (compartido) | ❌ caso / ✅ solicitud |
| 6 | **Base de Conocimiento** | Listado (tabla densa `KbBrowser`, métricas de ops) + detalle de artículo (`ArticleView`). **Compartida** con roles internos. | `/knowledge` · `/knowledge/[id]` | ✅ Sí (`knowledge.read`) |
| 7 | **Aprobaciones** | **NO existe superficie para el rol.** No hay ruta `/approvals`. Toda aprobación (CAB de cambios, recomendaciones de evolución) vive en módulos internos con permisos que el rol no posee. Las solicitudes de catálogo **no tienen paso de aprobación** (`open→fulfilled/cancelled`). | — | ❌ No aplica al rol |
| 8 | **Asistente IA** | "Consultar" del portal (`portalAssist`: KB + casos + guía IA gobernada). `/ai-center` **NO accesible** (`incident.read`). | `portal.tsx` + `lib/portal/assist.ts` | ✅ intake IA / ❌ ai-center |

**Superficies libres adicionales del rol (no listadas en el encargo, HECHO):** `/portal`, `/partner` (portal de partner), y las de KB. El sidebar/Command Menu muestra al `partner_user` exactamente **4 destinos**: `/service-catalog`, `/portal`, `/partner`, `/knowledge` (+ 1 quick-action rota, UX-005).

> **Decisión de alcance para la compuerta (ver §8):** el rediseño debe fijar si "experiencia Usuario" = **`/portal` (autoservicio interno)** —persona "colaborador/mesa de ayuda interna"— y/o **`/partner` (portal externo)**. El código hoy contiene **ambas narrativas para el mismo rol** (UX-009). El arquitecto confirmó verbalmente: *"el rol usuario, quienes registran y consultan sus casos"* → apunta a `/portal`. Se asume **`/portal` como superficie primaria** y `/partner` + KB como secundarias, **pendiente de confirmación**.

---

## 4. Componentes COMPARTIDOS con otros roles (zona de riesgo — lista explícita, HECHO)

Modificar cualquiera de estos afecta a Agente/Admin → **requiere STOP** antes de tocar (regla del encargo §6).

| Componente | Archivo | Qué comparte / qué difiere por permiso |
|---|---|---|
| Layout de app | `app/(app)/layout.tsx` | Shell entero + guard de ruta por permiso. |
| Sidebar | `components/app-shell/sidebar.tsx` | Nav filtrada por `canSeeNav`; auto-expansión por rol. |
| Header | `components/app-shell/header.tsx` | Único que varía por rol = la **CTA** (`resolvePrimaryAction`). Tema/idioma/logout/buscador idénticos. |
| Command Menu | `components/app-shell/command-menu.tsx` | Quick-actions, nav y búsqueda de entidades filtradas por permiso (mayor divergencia). |
| Help FAB | `components/app-shell/help-fab.tsx` | Idéntico; abre el Command Menu. |
| Wordmark / Icon | `components/app-shell/wordmark.tsx`, `components/ui/icon.tsx` | Idénticos; sin lógica de permiso. |
| KB browser + detalle | `components/knowledge/kb-browser.tsx`, `article-view.tsx`, `badges.tsx` | **Mismo archivo para usuario final y agente/curador.** Difiere: bloque `canManage` (gestión) y `canFeedback`. |
| Feedback widget | `components/knowledge/feedback-widget.tsx` | Candado `canFeedback` decidido **fuera** del componente (UX-014). |
| Catálogo (todo) | `components/catalog/service-catalog.tsx`, `catalog-grid.tsx`, `request-form.tsx`, `request-list.tsx`, `request-detail.tsx` | **Mismo archivo requester/agente/admin.** Difiere solo por props `canRequest`/`canManage`. |
| Detalle de incidente | `components/incidents/detail/incident-detail.tsx` + `CsatPanel` | Aloja el CSAT; **inaccesible al rol** pero es donde vive `survey.submit` (UX-006). |
| AiReport | `components/ai/ai-report.tsx` | Render IA/markdown propio; sin permiso. |
| Acción `createIncident` | `lib/incidents/actions.ts:85-127` | **Compartida** por el intake del portal y `/incidents/new` (agente). Sin gate de permiso explícito (solo `tenantId` + RLS). |
| Utilidades de lista | `components/common/filters.tsx`, `back-button.tsx` | Agnósticas al rol. |
| Diseño / tokens | `app/globals.css` | Base común de ambos temas. |

---

## 5. MATRIZ DE PARIDAD FUNCIONAL (HECHO)

> Cobertura: toda funcionalidad, acción, estado (vacío/carga/error/éxito), filtro, badge, notificación y permiso de las superficies reales del Usuario. Columna **Comp.** = compartido con otros roles (S/N). En 1.2 se anexará la columna de estado **PRESERVADA / MEJORADA / EN RIESGO**.

### Área A — Inicio · `/portal` (`components/portal/portal.tsx`) — dedicada al rol

| ID | Funcionalidad | Componente | Fuente de datos (real) | Comp. | Riesgo |
|---|---|---|---|---|---|
| A-01 | Hero de bienvenida con nombre + conteo de casos en curso | `portal.tsx:92-105` | `ctx.name`; `myCases` (derivado) | N | — |
| A-02 | Mensaje de éxito "caso creado {número}" | `portal.tsx:107-111` | estado local tras `createIncident` | N | — |
| A-03 | Explorar por categoría (chips que alimentan el intake) | `portal.tsx:113-137` | `listPortalCategories` → `incident_category` (status='active') | N | — |
| A-04 | Intake: asunto (textarea, mín. 8) | `portal.tsx:146-154` | estado local; validación `minLength` | S (val.) | UX-011 |
| A-05 | Intake: aplicación afectada (select) | `portal.tsx:157-163` | `listApplications` → `configuration_item` (≠deleted) | N | — |
| A-06 | Intake: categoría (select, auto-sugerida por IA) | `portal.tsx:164-170` | `incident_category` | N | — |
| A-07 | Intake: urgencia (select) | `portal.tsx:173-178` | enum `Urgency` (espeja BD) | N | UX-011 |
| A-08 | Acción "Consultar" (IA + búsqueda deflection) | `portal.tsx:60-69,183-185` | `portalAssist` → `searchKnowledge` + Claude; registra `agent_action` | N | — |
| A-09 | Acción "Registrar caso" | `portal.tsx:71-83,186-188` | `createIncident` → `incident`; `recordKbEvent` (escalation) | S | — |
| A-10 | Estado carga: "Buscando…" / "Creando…" | `portal.tsx:184,187` | `useTransition` | N | — |
| A-11 | Estado error de campo/global (`err.*`) | `portal.tsx:180` | `ErrorCode` i18n | N | — |
| A-12 | Sugerencias: guía IA + confianza % | `portal.tsx:205-213` | `portalAssist.guidance/confidence` (Claude) | N | R3 ok (degrada sin IA) |
| A-13 | Aviso "IA no configurada" (degradación honesta) | `portal.tsx:203` | `res.aiConfigured` | N | — |
| A-14 | Sugerencias: tarjetas KB (leer/ocultar + feedback) | `portal.tsx:215`,`269-289` | `searchKnowledge` → `knowledge_article(+version)` | S | UX-013 |
| A-15 | Sugerencias: casos resueltos similares | `portal.tsx:217-227` | `incident` (status='resolved') | N | enlace roto si !incident.read |
| A-16 | Estado vacío sugerencias / sin coincidencias | `portal.tsx:199,229-231` | — | N | — |
| A-17 | "Mis casos" (lista con dot de estado, fecha, nº) | `portal.tsx:238-264` | `getMyReportedCases` → `incident` (`reported_by_user_id`) | N | UX-007, UX-008, UX-012 |
| A-18 | "Mis casos": estado vacío | `portal.tsx:243-245` | — | N | — |
| A-19 | "Mis casos": fila NO clicable (sin `incident.read`) | `portal.tsx:258-260` | `canViewIncidents=false` | N | **UX-008** |

### Área B — Catálogo · `/service-catalog` tab "Catálogo" (`components/catalog/catalog-grid.tsx`)

| ID | Funcionalidad | Componente | Fuente de datos | Comp. | Riesgo |
|---|---|---|---|---|---|
| B-01 | Tabs contenedor (Catálogo / Mis solicitudes; Admin oculto) | `components/catalog/service-catalog.tsx:15-36` | `getAccessControl` (`canRequest`/`canManage`) | S | — |
| B-02 | Grid de items agrupado por categoría | `catalog-grid.tsx:12-24` | `listCatalogItems` → `service_item` (status='active') | S | UX-010 |
| B-03 | Tarjeta: nombre, descripción, `SLA: {sla_hours}h` | `catalog-grid.tsx:28-34` | `service_item` | S | — |
| B-04 | Botón "Solicitar" (si `canRequest`) → abre `RequestForm` | `catalog-grid.tsx:37-40` | prop `canRequest` | S | — |
| B-05 | Estado vacío "No hay servicios disponibles" | `catalog-grid.tsx:21` | — | S | — |
| B-06 | Sin búsqueda ni filtros en el catálogo | — | — | S | UX (descubribilidad) |

### Área C — Formularios de solicitud

| ID | Funcionalidad | Componente | Fuente de datos | Comp. | Riesgo |
|---|---|---|---|---|---|
| C-01 | Intake del portal (ver A-04…A-09) | `portal.tsx` | `createIncident` | S | UX-011 |
| C-02 | `RequestForm` dinámico desde `form_schema` (text/textarea/number/select/date) | `request-form.tsx:42-51` | `service_item.form_schema` | S | UX-010 |
| C-03 | Validación por campo (`required`, `number`, `select`∈opciones, `date` ISO) | `lib/catalog/validation.ts:18` | — | S | — |
| C-04 | Envío `submitRequest` (re-valida `service_catalog.request`) | `lib/catalog/actions.ts:19-62` | RPC `create_service_request` → `incident`+`service_request`; opcional `start_workflow` | S | — |
| C-05 | Estados: enviando/error de campo/error global/éxito→redirect | `request-form.tsx:26-59` | `useTransition` | S | — |
| C-06 | Indicador `*` en campos requeridos | `request-form.tsx:41` | `form_schema.required` | S | — |

### Área D — Mis Casos (tres superficies)

| ID | Funcionalidad | Componente | Fuente de datos | Comp. | Riesgo |
|---|---|---|---|---|---|
| D-01 | "Mis casos" del portal (scoping `reported_by_user_id`) | `portal.tsx:238-264` | `getMyReportedCases` → `incident` | N | **UX-007** |
| D-02 | "Mis solicitudes" del catálogo (KPIs open/fulfilled/overdue) | `request-list.tsx:40-46` | `listRequests` → `service_request` (**tenant-wide**) | S | **UX-002** |
| D-03 | Solicitudes: filtros/agrupación/drill (status/item/solicitante) | `request-list.tsx` + `common/filters` | — | S | — |
| D-04 | Solicitudes: `StatusPill` + SLA vencido en rojo + nº caso | `request-list.tsx:9-13,29-35` | `service_request.status/sla_due_at/incident` | S | — |
| D-05 | Solicitudes: fila → detalle `/service-catalog/requests/{id}` | `request-list.tsx:31` | — | S | UX-003 |
| D-06 | Solicitudes: estado vacío "No tienes solicitudes" | `request-list.tsx:56` | — | S | mismatch con D-02 |
| D-07 | "Mis tickets" del `/partner` (scoping `affected_party_id`) | `partner-portal.tsx:40-55` | `getPartnerPortal` → `incident` | N | **UX-007, UX-019** |
| D-08 | `/partner`: KPIs open/resolved/total + branding + links autoservicio | `partner-portal.tsx:32-66` | `getPartnerPortal` (fallback a partner demo) | N | UX-019 |
| D-09 | `/partner`: tickets read-only, NO clicables | `partner-portal.tsx:46-53` | — | N | UX-008 |

### Área E — Detalle de caso

| ID | Funcionalidad | Componente | Fuente de datos | Comp. | Riesgo |
|---|---|---|---|---|---|
| E-01 | Detalle de incidente (hilo, timeline, panel) | `components/incidents/detail/incident-detail.tsx` | `/incidents/[id]` | S | **INACCESIBLE** (`incident.read`) |
| E-02 | Detalle de **solicitud**: `form_data`, caso ancla, solicitante, SLA | `components/catalog/request-detail.tsx` | `getRequest` → `service_request` (**sin owner check**) | S | **UX-003** |
| E-03 | Detalle solicitud: link "Caso ancla" → `/incidents/{id}` | `request-detail.tsx:49` | — | S | **UX-004** (→/unauthorized) |
| E-04 | Detalle solicitud: sin acciones para el requester (Cumplir/Cancelar ocultos) | `request-detail.tsx:77-84` | `canManage=false` | S | UX (no puede cancelar su solicitud) |
| E-05 | CSAT del caso (estrellas + comentario) | `components/csat/csat-panel.tsx` | `submitCsat` → `case_survey` | S | **UX-006** (sin UI para el rol) |

### Área F — Base de Conocimiento

| ID | Funcionalidad | Componente | Fuente de datos | Comp. | Riesgo |
|---|---|---|---|---|---|
| F-01 | Listado KB: tabla de 7 columnas | `kb-browser.tsx:66-83` | `getKb` → `knowledge_article` | S | **UX-001** |
| F-02 | KPIs de ops: artículos/útil%/deflections/escalations/review | `kb-browser.tsx:42-48` | `getKb.metrics` | S | **UX-001** (impropio p/usuario) |
| F-03 | Columnas: nº, título, tipo, categoría, **views, deflect, health** | `kb-browser.tsx:24-36,68-69` | `knowledge_article` | S | **UX-001** |
| F-04 | Filtros/agrupación/drill (tipo/categoría/status/salud) | `kb-browser.tsx:15-21,61-64` | — | S | — |
| F-05 | Estado vacío "kb.empty" | `kb-browser.tsx:70` | — | S | — |
| F-06 | Detalle de artículo: contenido (AiReport), tags, métricas | `article-view.tsx:22-51` | `getArticle` | S | UX-013 |
| F-07 | Detalle: origen (problema / incidente ancla) | `article-view.tsx:53-70` | `knowledge_article.source_*` | S | link puede ir a ruta bloqueada |
| F-08 | Detalle: feedback útil/no-útil + comentario | `article-view.tsx:73-75` + `feedback-widget.tsx` | `submitKbFeedback` | S | UX-014 |
| F-09 | Detalle: registro de vista/telemetría | `app/(app)/knowledge/[id]/page.tsx:20` | `recordKbEvent(view)` | S | — |
| F-10 | Detalle: bloque de gestión (tipo/publicar) | `article-view.tsx:78-94` | `canManage` | S | oculto p/usuario (ok) |

### Área G — Aprobaciones

| ID | Funcionalidad | Realidad | Riesgo |
|---|---|---|---|
| G-01 | Bandeja de aprobaciones del usuario | **No existe** ruta ni componente para el rol | Área nominal sin implementación para Usuario |
| G-02 | Estado de aprobación de solicitudes de catálogo | Ciclo `open→fulfilled/cancelled`, **sin `pending_approval`** (`request-list.tsx:9-13`) | El usuario no ve ni ejerce aprobación |

### Área H — Asistente IA

| ID | Funcionalidad | Componente | Fuente de datos | Comp. | Riesgo |
|---|---|---|---|---|---|
| H-01 | "Consultar" del portal (guía IA gobernada) | `portal.tsx:60-69` + `lib/portal/assist.ts` | Claude (`callClaude`) sobre KB+casos reales; audita `agent_action` | N | R3 ok |
| H-02 | Degradación honesta sin clave IA (búsqueda por palabras) | `assist.ts:57-60` | `searchKnowledge` | N | R3 ok |
| H-03 | `/ai-center` (centro de IA) | `app/(app)/ai-center/page.tsx` | — | S | **INACCESIBLE** (`incident.read`) |

### Chrome compartido (transversal a todas las áreas)

| ID | Funcionalidad | Componente | Comp. | Riesgo |
|---|---|---|---|---|
| X-01 | CTA primaria "Reportar caso" → `/portal` | `header.tsx:79-88` + `role-ux.ts` | S | — |
| X-02 | Command Menu: 1 quick-action + 4 nav + búsqueda de artículos | `command-menu.tsx` | S | **UX-005, UX-018** |
| X-03 | Conmutador de tema (Nexus/Claro) | `header.tsx:101-109` | S | — |
| X-04 | Conmutador de idioma (ES/EN) | `header.tsx:111-119` | S | — |
| X-05 | Buscador global (Ctrl/⌘K) + Help FAB | `header.tsx:90-99`, `help-fab.tsx` | S | — |
| X-06 | Logout server-side | `header.tsx:121-140` | S | — |
| X-07 | Sidebar: 4 destinos visibles al rol | `sidebar.tsx` + `navigation.ts` | S | — |

---

## 6. Design tokens — línea base (HECHO · `app/globals.css`)

Resumen (detalle completo verificado, útil para Sub-Fase 1.1):

- **Conmutación:** atributo `data-theme` en `<html>` (`nexus` | `claro`), set por `theme-provider.tsx`, `localStorage: credix.theme`, default `nexus`. Sin media-query.
- **Tipografía:** `--font-display` (Jakarta, títulos) · `--font-ui` (Inter, cuerpo) · `--font-mono` (JetBrains, **todo dato numérico** — §DESIGN). `.mono/.num` con `tnum`.
- **Radios:** `--r-xs 6` → `--r-2xl 16` + `--r-pill 20`.
- **Acento marca:** Nexus `--accent #E4002B` (rojo sobre fondo `#0B0C0E`); Claro `--accent #E30613` (rojo sobre blanco). CTA propia (`--cta-*`).
- **Color semántico de estado/SLA (`--st-*`) por tema:** critical / high / medium / low / verified / info / eval — con `-fg` y `-bg` legibles en cada tema.
- **Elevación:** `--sh-card` distinto por tema (sombra fuerte en oscuro, sutil en claro).
- **Utilidades:** `.cx-btn-primary`, `.cx-btn-outline`, `.cx-lift` (hover elevación), `.cx-row` (hover fila), `.cx-empty` (estado vacío), `@media prefers-reduced-motion` (accesibilidad).
- **Fragilidad (UX-015):** los alias `--surface/--ink/--primary/--primary-hover/--on-primary` existen **solo** en tema Claro; su uso sin fallback rompe Nexus.

---

## 7. Hallazgos UX (registro numerado)

| ID | Sev. | Hallazgo | Evidencia | Tipo |
|---|---|---|---|---|
| **UX-001** | Alta | KB que ve el usuario final es una **tabla densa con métricas de operación** (views, deflections, health, escalations) impropias para el usuario: poco visual, sin clasificación sencilla, sin ayuda. **Coincide con la dirección del arquitecto** ("Knowledge Management real"). | `kb-browser.tsx:42-83` | HECHO |
| **UX-002** | **Crítica** | "Mis solicitudes" muestra **TODAS las solicitudes del tenant**, no las propias (query sin filtro `requested_by_user_id` + RLS tenant-wide), pese al rótulo y al vacío "No tienes solicitudes". Fuga de datos y nombres de otros usuarios. Viola R2 (mismatch UI↔dato). | `lib/catalog/queries.ts:50-54`; `sql/0063:81-84` | HECHO |
| **UX-003** | **Crítica** | Detalle de solicitud **sin control de propiedad** (IDOR a nivel tenant): cualquier `id` es accesible con `service_catalog.read`, exponiendo `form_data` y caso ancla de otros. | `request-detail`; `lib/catalog/queries.ts:79-86` | HECHO |
| **UX-004** | Alta | Link "Caso ancla" del detalle de solicitud → `/incidents/{id}`, ruta gateada por `incident.read` → **`/unauthorized`** para el requester. | `request-detail.tsx:49`; `access.ts:14` | HECHO |
| **UX-005** | Alta | Quick-action "Nuevo incidente" del Command Menu → `/incidents/new` (prefijo `/incidents` exige `incident.read`) → **`/unauthorized`**. Callejón sin salida. | `command-menu.tsx:95-97`; `navigation.ts:125` | HECHO |
| **UX-006** | Alta | `survey.submit` concedido a `partner_user` **sin UI accesible**: el `CsatPanel` solo vive en `/incidents/[id]` (bloqueado). El usuario **nunca puede calificar su caso**. Permiso huérfano. | `incident-detail.tsx:264`; `csat-panel.tsx` | HECHO |
| **UX-007** | Alta | **Tres superficies "mis casos" con scoping distinto e inconsistente:** portal (`reported_by_user_id`), partner (`affected_party_id`), catálogo (tenant-wide). Confuso; el usuario no tiene un único lugar de verdad. | `portal.tsx`, `partner/queries.ts:27-31`, `catalog/queries.ts:50` | HECHO |
| **UX-008** | Alta | **No hay detalle de caso para el usuario:** filas no clicables (portal y partner). "Consultar sus casos" se limita a una lista de estado — **contradice el principio client-centric de tracking/comunicación** de CLAUDE.md §0. | `portal.tsx:258-260`; `partner-portal.tsx:46-53` | HECHO |
| **UX-009** | Media | **Persona ambigua:** `/portal` habla a "colaborador / mesa de ayuda interna"; `/partner` a "partner externo". Ambos mapeados al mismo rol `partner_user`. Doble narrativa. | `dictionaries.ts:1346`; `partner-portal.tsx`; `sql/0012:21` | HECHO/INTERP. |
| **UX-010** | Media | Nombres de categoría y `label` de `form_schema` en crudo desde BD (español), **sin i18n** → rompe ES/EN del contenido de negocio (§11 i18n real). El chrome sí está i18n. | `catalog-grid.tsx:24`; `request-form.tsx` | HECHO |
| **UX-011** | Media | Intake del portal fija `impact:"medium"`, `title`=primeros 120 chars; no explica la prioridad derivada (falta explainability). | `portal.tsx:76` | HECHO |
| **UX-012** | Media | `/portal` sin visualización gráfica (cero charts / anillos SLA / donuts); "Mis casos" es lista textual. Alta carga cognitiva → confirma el diagnóstico del encargo como HECHO en la superficie real. | `portal.tsx` | HECHO |
| **UX-013** | Media | `AiReport` es un mini-parser propio (no markdown estándar): tablas/enlaces/code fences no renderizan bien → limita "Knowledge Management real". | `ai-report.tsx:16-44` | HECHO/INTERP. |
| **UX-014** | Baja | `FeedbackWidget` confía en prop `canFeedback` calculada por cada contenedor; riesgo de candado inconsistente de `knowledge.feedback`. | `feedback-widget.tsx:23` | INTERP. |
| **UX-015** | Baja | Alias de token `--primary/--surface/--ink` existen solo en tema Claro; uso sin fallback rompe Nexus. | `globals.css:110-117` | HECHO |
| **UX-016** | Baja | Hex hardcodeados fuera de tokens (help-fab sombra, wordmark fallback, command-menu overlay). Deuda de design system. | `help-fab.tsx:20`; `wordmark.tsx:25-27`; `command-menu.tsx:162` | HECHO |
| **UX-017** | Baja | `partner_admin` tiene **cero** permisos en vivo → rol inerte. | BD `role_permission` | HECHO |
| **UX-018** | Media | Asimetría `incident.create` vs `incident.read`: el usuario puede **crear** incidentes pero no **listar/abrir/buscar** los suyos desde el chrome. | `command-menu.tsx`; `navigation.ts` | HECHO |
| **UX-019** | Media | `/partner` usa **fallback a "partner demo"** (party originador) si el usuario no tiene `party` → riesgo de mostrar datos demo en producción; tickets read-only sin drill-down. | `partner/queries.ts:18-23` | HECHO |

---

## 8. Inputs de dirección del arquitecto (capturados para 1.1/1.2 — NO ejecutados en 1.0)

1. **Drill-down en todo:** cada cifra/estado/lista debe permitir profundizar. Hoy falta el eslabón clave: **el detalle del propio caso** (UX-008) y drill en `/partner` (UX-019).
2. **Knowledge Management real:** la sección de Conocimiento se percibe pobre (poco material, poco visual, poca ayuda, sin clasificación sencilla). Alineado con UX-001/UX-013. Objetivo: reemplazar la tabla de ops por una experiencia de descubrimiento visual y clasificación simple para el usuario final.

*(Guardado también como memoria de proyecto para persistir entre sesiones.)*

---

## 9. Supuestos y preguntas para la COMPUERTA (requieren decisión del arquitecto)

**Supuestos detectados:**
1. La superficie primaria del rol Usuario es **`/portal`** (autoservicio interno). `/partner` y KB son secundarias. *(Basado en la aclaración verbal; requiere confirmación por la doble narrativa UX-009.)*
2. El detalle de incidente `/incidents/[id]` y `/ai-center` **quedan fuera** del rediseño del Usuario por ser inaccesibles al rol; el rediseño debe **crear un detalle de caso apropiado para el usuario** (no reutilizar la vista de agente) para cumplir el principio client-centric.

**Preguntas de compuerta:**
- **P1 (alcance):** ¿La "experiencia Usuario" a rediseñar es solo `/portal` + KB, o incluye consolidar/reemplazar `/partner` y "Mis solicitudes"? Hoy hay **3 superficies de "mis casos"** solapadas (UX-007) — ¿unificarlas?
- **P2 (detalle de caso):** El usuario hoy **no puede abrir su caso** (UX-008). ¿Se crea un detalle de caso propio del usuario (hilo/seguimiento/CSAT) respetando que no tiene `incident.read`? Esto implicaría **nuevo backend/permiso** (fuera de solo-UI) → decisión de arquitectura.
- **P3 (hallazgos críticos):** UX-002 y UX-003 son **fugas de datos** (no solo UX). ¿Se corrigen dentro de esta fase o se derivan como issue de seguridad separado? Tocan queries/RLS (STOP: multi-capa + seguridad, §2.4/§3.2).
- **P4 (CSAT huérfano, UX-006):** ¿El rediseño debe **habilitar** al usuario a calificar su caso (dar superficie a `survey.submit`), o se revoca el permiso?

### 9.1 DECISIONES DEL ARQUITECTO (2026-07-13 — resueltas en la compuerta)

| # | Decisión | Consecuencia para el rediseño |
|---|---|---|
| **P1** | **Portal como hub único + consolidar.** | `/portal` se rediseña como hub central del Usuario; se **unifican** las tres vistas de "mis casos" (portal `reported_by_user_id`, partner `affected_party_id`, catálogo tenant-wide → un solo lugar de verdad). `/partner` y "Mis solicitudes" se reconcilian dentro del portal. KB se rediseña (UX-001). |
| **P2** | **Crear detalle propio del Usuario.** | Nueva vista de seguimiento del caso para el Usuario (hilo/estado/timeline/CSAT). Requiere **backend/permiso nuevo** (p.ej. lectura de casos propios acotada + **RLS por `reported_by_user_id`**). **NO es solo-UI.** |
| **P3** | **Corregir ahora (bloqueador).** | UX-002 y UX-003 se corrigen dentro de la fase: scoping por propietario en query + **endurecer RLS** a filas propias. Bloqueador R2/seguridad. |
| **P4** | **Habilitar CSAT para el Usuario.** | Se da superficie a `survey.submit`: el Usuario califica su caso desde su detalle/seguimiento al resolverse (depende de P2). |

> **Cambio de naturaleza del encargo (registrar):** el brief original acotaba el trabajo a **solo la superficie UI del Usuario** y marcaba RLS/permisos/backend como **STOP / no tocar** (R8). Con P2+P3+P4 el arquitecto **autoriza explícitamente** tocar **backend, RLS, permisos y migraciones** para estos ítems concretos. Ello **activa la disciplina audit-grade** (§10/§11 de CLAUDE.md): migración formal en `sql/`, policies RLS con `ENABLE ROW LEVEL SECURITY` + `tenant_id` **y** propietario, eventos de ledger (`immutable_audit_event`) para mutaciones, i18n ES/EN, y pruebas. Estos cambios seguirán requiriendo STOP puntuales por afectar componentes **compartidos** con Agente/Admin (§4) y capas sensibles.

---

## 10. Entregable y estado

- **Archivo:** `docs/fase1/00_inventario_paridad.md` (este documento).
- **Cobertura:** 8 áreas nominales reconciliadas contra el código; matriz con **~70 filas** de funcionalidad/estado/badge/permiso; 19 hallazgos UX; lista explícita de componentes compartidos; tokens base; permisos y RLS verificados contra la **BD viva**.
- **Sin cambios de código** (solo `docs/fase1/` + memoria de proyecto).
- **Nada declarado "listo" prematuramente:** la paridad se marcará PRESERVADA/MEJORADA/EN RIESGO en 1.2.

---

**STOP — ESPERANDO APROBACIÓN.**

No escribiré ninguna línea de la Sub-Fase 1.1 (sistema visual y concepto) hasta recibir aprobación explícita y una decisión sobre las preguntas P1–P4 de la §9.
