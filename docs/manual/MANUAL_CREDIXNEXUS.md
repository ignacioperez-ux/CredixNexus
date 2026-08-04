# Manual documental integral — Credix Nexus

> **Propósito.** Este documento es el **detalle documental completo** de la plataforma Credix
> Nexus, construido leyendo el código real del repositorio (rutas de archivo citadas, sin datos
> inventados). Sirve simultáneamente como base para tres manuales:
>
> - **Manual de usuario** — qué hace cada pantalla, para qué rol, cómo se usa.
> - **Manual técnico** — datos que lee/escribe, permisos, auditoría (ledger), multi-tenant/RLS.
> - **Manual de pantallas** — secciones, componentes, acciones, filtros y estados de cada vista.
>
> Es también el **insumo único** que se entrega a Claude Design para elaborar los manuales finales
> de los usuarios de Credix (ver `PROMPT_CLAUDE_DESIGN.md`).

**Generado:** 2026-08-04 · **Alcance:** 85 pantallas (rutas `app/(app)/*` + landing) · 8 categorías
macro · 6 personas de rol · capítulos transversales (RBAC, RLS, ledger, i18n, design system, stack).

---

## 0. Qué es Credix Nexus (contexto para el manual)

Plataforma **ITSM + Motor de Transformación** *audit-grade* para Credix (fintech de crédito B2B).
Principio rector: *ningún incidente crítico debe quedar como simple ticket si revela una oportunidad
estructural de mejora, automatización, rediseño, control, riesgo o evolución del negocio.*

**Centro de la herramienta (no negociable):** tracking y comunicación permanente, **client-centric
siempre**. Cuando una incidencia genera un cambio importante y pasa al **squad de Evolución**, la
mesa de ayuda **nunca pierde el control**: la incidencia queda como **ancla** (estado `in_evolution`,
no `closed`), enlazada bidireccionalmente al proyecto, y el hilo de comunicación con el cliente
**sobrevive** la transición incidencia → evolución → proyecto. Marcos de referencia: **ITIL 4**,
**COBIT 2019**, **ISO/IEC 20000**.

**Stack real (monolito modular):** Next.js 16 (App Router) + React 19 + TypeScript · Supabase
(PostgreSQL 17, Auth, **Row-Level Security**, Storage, Edge Functions, Realtime) · Tailwind CSS v4 +
design system propio. Multi-tenant, multiempresa, multimodal, bilingüe **ES/EN**.

---

## 1. Cómo está organizado este documento

El inventario está partido en **5 clústeres funcionales**. Cada pantalla se documenta con la misma
plantilla: *Ruta y parámetros · Módulo/categoría · Propósito (usuario) · Roles y permisos · Pantalla
(componentes/acciones) · Funcional/técnico (datos, mutaciones, auditoría) · Flujos clave.*

| Clúster | Contenido | Pantallas |
|---|---|---|
| **A — Mesa de ayuda / Tickets** | Inicio, incidencias, admisión/triage, incidentes mayores, catálogo de servicios, portal de autoservicio | 14 |
| **B — Operaciones + Analítica** | Torre de Control, gobierno SLA, clientes, fraude/disputas, riesgo, analítica y comportamiento, trazabilidad, cola del equipo | 12 |
| **C — Evolución + Proyectos** | Torre de Evolución, mapa de tribus, proyectos/portafolio, problemas, cambios, squads, observabilidad, dependencias, proveedores | 24 |
| **D — Talento + Conocimiento + IA** | Talento/carga/áreas, base de conocimiento, centro de IA, motor de reglas/scoring, workflows, procesos | 14 |
| **E — Administración + Transversales** | Admin/SSO, datos maestros, CMDB, ledger, portales de rol (mi-*), landing; + 7 capítulos transversales | 18 + 7 |

---

## 2. Mapa de módulos (8 categorías macro)

Fuente única: `lib/nav/navigation.ts`. El sidebar y el Command Menu consumen esta configuración; no
hay navegación hardcodeada en componentes. Cada ítem conserva su `path` real y su `perm` (mismo
candado que el guard de ruta en `lib/nav/access.ts`).

1. **Inicio** — Dashboard, Workspace.
2. **Tickets (Mesa de ayuda)** — Incidencias, Admisión (Triage), Incidentes mayores, Catálogo de servicios, Autoservicio (Portal).
3. **Operaciones** — Torre de Control, Gobierno SLA, Clientes, Fraude y Disputas, Riesgo operativo.
4. **Evolución** — Torre de Evolución, Mapa de Tribus, Proyectos, Portafolio, Casos en Evolución, Problemas, Cambios, Squads, Observabilidad, Dependencias, Proveedores.
5. **Talento** — Agentes/Talento, Recursos (Carga), Áreas de entrega.
6. **Conocimiento** — Base de conocimiento, Revisión KB, Centro de IA, Reglas, Workflows.
7. **Analítica** — Analítica, Comportamiento.
8. **Administración** — Admin, Dominios SSO, Datos maestros (Catálogo), Procesos, CMDB, Ledger.

---

## 3. Roles y personas (quién ve qué)

Cada usuario recibe una **experiencia de navegación por persona**. La segregación es de doble capa:
permiso por ruta (`ROUTE_PERMISSIONS`) + denylist por persona (`ROLE_ROUTE_DENY`), en el guard único
de `app/(app)/layout.tsx`. Fuente: `lib/nav/navigation.ts`, `lib/nav/role-ux.ts`, `lib/nav/access.ts`.

| Rol (código) | Persona | Home | Navegación | Qué hace |
|---|---|---|---|---|
| `system_admin` / `tenant_admin` | Administrador | `/dashboard` | MACRO_NAV (todo) | Configura la plataforma, ve todos los módulos. |
| `support_lead` | **Gerente de Operaciones** | `/operaciones` | OPERATIONS_NAV | Torre de Control: admite, asigna, gobierna SLA, declara incidentes mayores. |
| `support_agent` | **Operador** | `/mi-dia` | SUPPORT_AGENT_NAV | Ejecuta solo sus casos asignados; consulta la cola en solo lectura; propone KB. |
| `product_owner` | **Gerente de Evolución/TI** | `/evolucion` | EVOLUTION_NAV | Portafolio, proyectos, priorización WSJF, decisión de negocio de las mejoras. |
| `squad_member` | **Miembro de Squad** | `/mi-trabajo` | SQUAD_MEMBER_NAV | Ve solo lo suyo: su trabajo, su squad, sus iniciativas, su perfil. |
| `partner_user` | **Usuario final** | `/portal` | USER_NAV (portal plano) | Registra y consulta sus propios casos (autoservicio, client-centric). |
| *Adyacentes:* `business_owner`, `grc_officer`, `change_manager`, `auditor`, `people_lead`, `responsable_comercial` | — | según permiso | MACRO_NAV gateada | Heredan de la persona más cercana; ven lo que su permiso habilita. |

> **Nota de datos (verificada en BD):** la cuenta de demo `operaciones@credix.local` (Giselle Arias)
> tiene **dos roles**: `support_lead` + `responsable_comercial`. El RPC `my_access()` devuelve los
> roles sin orden determinista, lo que puede afectar el `home` resuelto (`/operaciones` vs `/portal`).

---

## 4. Convenciones que atraviesan toda la aplicación

- **Cero hardcode / cero mock:** todo valor de negocio (catálogos, umbrales, mapeos) sale de la BD
  real. Ningún componente stubbea resultados. Los estados vacíos son honestos (sin datos demo).
- **Audit-grade absoluto:** ninguna mutación relevante existe sin su `immutable_audit_event`. El
  ledger es *append-only* con **hash-chaining** (SHA-256 + `previous_hash`), escrito por
  `append_audit_event` y por triggers `audit_row_change()` a nivel tabla; verificable con
  `verify_audit_chain`.
- **Multi-tenant desde el origen:** todo dato operativo lleva `tenant_id` + RLS por tenant.
- **i18n real ES/EN:** cero textos quemados; todo copy visible sale de `lib/i18n/dictionaries.ts`
  vía `t(MessageKey)`. Formatos `es-CR` / `en-US` / moneda `CRC`.
- **PII enmascarada:** nombres, cédula/taxId, email y teléfono se enmascaran en listas y logs.
- **Design system Credix:** dos temas conmutables **Nexus** (oscuro) y **Claro** (claro, por
  defecto en el portal del Usuario). Acento de marca **rojo Credix `#E42313`** en ambos temas.
  Fuente **Heebo**. Datos numéricos en tipografía mono. El teal/lima es color de dato secundario
  (data-viz), no acento de marca.

---

## 5. Índice de pantallas (85)

**A · Mesa de ayuda:** `/dashboard` · `/workspace` · `/incidents` · `/incidents/[id]` ·
`/incidents/[id]/edit` · `/incidents/new` · `/triage` · `/major-incidents` · `/major-incidents/[id]` ·
`/service-catalog` · `/service-catalog/requests/[id]` · `/portal` · `/portal/cases/[id]` · `/partner`

**B · Operaciones:** `/operaciones` · `/sla-governance` · `/customers` · `/customers/[id]` ·
`/fraud-disputes` · `/fraud-disputes/fraud/[id]` · `/fraud-disputes/dispute/[id]` · `/risk` ·
`/analytics` · `/analytics/comportamiento` · `/casos-convertidos` · `/cola-equipo`

**C · Evolución:** `/evolucion` · `/evolucion/mapa` · `/projects` · `/projects/[id]` ·
`/projects/[id]/edit` · `/projects/new` · `/projects/portafolio` · `/problems` · `/problems/[id]` ·
`/problems/[id]/edit` · `/problems/new` · `/changes` · `/changes/[id]` · `/changes/[id]/edit` ·
`/changes/new` · `/squads` · `/squads/[id]` · `/observability` · `/dependencies` · `/vendors` ·
`/vendors/[id]` · `/vendors/[id]/edit` · `/vendors/new`

**D · Talento / Conocimiento / IA:** `/talent` · `/talent/[id]` · `/workload` · `/delivery-areas` ·
`/knowledge` · `/knowledge/[id]` · `/knowledge/revision` · `/ai-center` · `/rules` · `/workflows` ·
`/workflows/[id]` · `/workflows/definitions/[id]` · `/processes` · `/processes/[id]`

**E · Administración + portales de rol:** `/admin` · `/admin/sso-domains` · `/catalog` ·
`/catalog/[catalog]` · `/catalog/[catalog]/new` · `/catalog/[catalog]/[id]/edit` · `/cmdb` ·
`/ledger` · `/mi-dia` · `/mis-casos` · `/mi-desempeno` · `/mi-perfil` · `/mi-trabajo` · `/mi-squad` ·
`/mis-iniciativas` · `/notificaciones` · `/` (landing) · `/start` · `/unauthorized`

---

# Detalle por clúster

A continuación, el detalle completo pantalla por pantalla. Cada clúster fue documentado leyendo el
código fuente; las afirmaciones no verificables se marcan explícitamente como *(no verificado)*.

---


# Clúster A — Mesa de ayuda / Tickets

# CLUSTER A — Mesa de Ayuda / Tickets + Inicio

Documentacion tecnica y de usuario de las pantallas del cluster de mesa de ayuda e inicio de
**Credix Nexus**. Toda afirmacion sale del codigo real (page.tsx, componentes, lib/*). Copy visible
es i18n ES/EN via `lib/i18n/dictionaries.ts` (claves `t("...")`), servido por `lib/i18n/provider`.

Notas transversales previas (verificadas):
- Contexto de request: `getContext()` (`lib/auth/context`) expone `supabase`, `tenantId`, `accountId`
  (id de cuenta/usuario), `partyId`, `name`. Los `page.tsx` cortan con `if (!ctx) return null`.
- Permisos: `getAccessControl()` (`lib/auth/session`) resuelve `isAdmin`, `roles[]`, `perms[]`
  cacheado por request (el layout ya llamo `my_permissions`/`my_roles`). Helper local `can(code)`.
- Ledger/auditoria: `getLedgerForEntity` lee la tabla **`immutable_audit_event`**
  (`block_height, action, actor_type, current_hash, timestamp`) filtrada por `entity_id`. Las
  mutaciones de negocio se auditan por trigger de BD (audit_row_change), no en el server action.
- Multi-tenant: RLS filtra por tenant automaticamente; las queries igual se acotan por contexto.
- Navegacion: fuente unica `lib/nav/navigation.ts` (MACRO_NAV + overlays por persona) y guard de
  ruta por `lib/nav/access.ts` (`ROUTE_PERMISSIONS` + `ROLE_ROUTE_DENY` por persona).

---

## 1. /dashboard — Command Center (Torre operativa)

**1. Ruta y parametros:** `/dashboard`. Sin parametros.
Archivo: `app/(app)/dashboard/page.tsx`.

**2. Modulo / categoria:** Macro **Inicio** (`nav.macro.inicio`, icono `home`), item `nav.dashboard`,
perm `incident.read`. Persona: staff. Admin conserva el dashboard ejecutivo; **`support_lead` es
redirigido a `/operaciones`** (Torre de Control unificada); el usuario final (sin `incident.read`)
se redirige a `/start`.

**3. Proposito (manual de usuario):** Panel de mando operativo: resumen antes que detalle. Muestra
el estado agregado de la mesa (backlog, ingreso del dia, sin asignar, incumplimientos SLA,
resueltos ultimos 30d, reaperturas) y permite drill accionable a las colas. Responde "¿como esta la
operacion ahora mismo?" para gerencia/admin.

**4. Roles y permisos:** requiere `incident.read` (ruta y guard). Defense-in-depth en la page:
si no es admin y no tiene `incident.read` -> `/start`; si es `support_lead` (no admin) -> `/operaciones`.

**5. Pantalla:** Componente `components/dashboard/command-center.tsx` (con `KpiGrid` de
`components/dashboard/kpi-grid.tsx`). Cuatro pestanas (`Tab`): **Resumen** (`dash.tab.summary`),
**Colas** (`dash.tab.queues`), **Carga** (`dash.tab.load`), **SLA** (`dash.tab.sla`). KPIs:
`dash.backlog`, `dash.today`, `dash.unassigned`/`dash.totake`, `dash.slabreach`/`dash.overdue`,
`dash.resolved30`/`dash.reopen`. Visualizaciones: embudo por estado (FUNNEL: triaged, assigned,
in_progress, waiting, reopened, resolved), workload por agente (top 8) y aging con colores por
tramo (`0-1d`..`7d+`). Estado vacio: `dash.opsempty`. Enlaces (drill) via `<Link>`. El dato numerico
va en mono; el estado se codifica en color (tokens `--st-*`).

**6. Funcional/tecnico:** Lee en paralelo 3 fuentes reales bajo RLS:
`supabase.rpc("dashboard_counts")` (inventario: cmdb, integrations, processes, products, ledger),
`getSupervisor(supabase)` y `getOverview(supabase)` (ambos de `lib/analytics/queries` — RPC
`supervisor_metrics` + `analytics_overview`). Solo lectura; sin mutaciones. Sin datos mock.

**7. Flujos clave:** (a) Entrar -> ver Resumen -> cambiar de pestana para colas/carga/SLA.
(b) Detectar backlog/SLA -> click en KPI/enlace -> drill a `/incidents` con filtros.

---

## 2. /workspace — Espacio del agente (colas)

**1. Ruta y parametros:** `/workspace`. Sin parametros. Archivo: `app/(app)/workspace/page.tsx`.

**2. Modulo / categoria:** Macro **Inicio**, item `nav.workspace`, perm `incident.read`. Es el
**home por defecto** de agente/operaciones (`defaultHome`: con `incident.read` -> `/workspace`).

**3. Proposito:** Bandeja de trabajo del agente: agrupa sus casos abiertos en colas seleccionables
(mis casos, por asignar, sin asignar, criticos, SLA en riesgo, pendiente triage, reabiertos,
sensibles, alto impacto) para que sepa "¿que atiendo ahora?". Abre automaticamente la primera cola
con casos para no caer en vista vacia.

**4. Roles y permisos:** `incident.read`. La cola "mis casos" se resuelve por `userId` del contexto.

**5. Pantalla:** Componente `components/workspace/agent-workspace.tsx`. Intro `ws.intro`. Colas como
tarjetas (grid): `ws.q.mine`, `ws.q.toassign`, `ws.q.unassigned`, `ws.q.critical` (danger),
`ws.q.slarisk` (danger), `ws.q.triage`, `ws.q.reopened`, `ws.q.sensitive`, `ws.q.impact`. Tabla de
la cola activa con columnas `inc.col.number/title/app/priority`, `ws.col.sla`, `inc.col.status`
(usa `StatusPill`, `PriorityTag` de `components/incidents/badges.tsx`). Estado vacio `ws.empty`.
Montos en formato moneda CRC. Filas enlazan al detalle via `<Link>`.

**6. Funcional/tecnico:** `getWorkspace(ctx.supabase, ctx.accountId)` (`lib/workspace/queries.ts`).
Una sola query a `incident` excluyendo `resolved/closed/cancelled` (limit 400, orden por `opened_at`)
y clasifica en buckets en memoria: `isMine` (assigned_user_id o assignee.user_id = userId),
`isUnassigned`, `slaAtRisk` (`sla_resolution_due_at` < now+24h), etc. Solo lectura.

**7. Flujos clave:** (a) Entrar -> se abre la cola prioritaria con casos -> click en un caso ->
detalle. (b) Cambiar de cola con las tarjetas para ver criticos/SLA en riesgo.

---

## 3. /incidents — Lista de incidencias (split master-detail)

**1. Ruta y parametros:** `/incidents?status=&assignee=&view=`.
Archivo: `app/(app)/incidents/page.tsx`.

**2. Modulo / categoria:** Macro **Tickets** (`nav.macro.tickets`, icono `inbox`), item
`nav.incidents`, perm `incident.read`.

**3. Proposito:** Listado central de casos de la mesa con estadisticas, filtros y vista previa
lateral. El staff consulta, filtra y ejecuta acciones contextuales (cambiar prioridad, asignar,
resolver, enviar a Evolucion) segun su permiso. Es la pantalla operativa nucleo de la mesa.

**4. Roles y permisos:** ver requiere `incident.read`. Acciones habilitadas por `can(...)` en la
page (matriz de responsabilidad):
- `canResolve` = `incident.resolve`
- `canEvolve` = `problem.manage` OR `project.manage` (Evolucion convierte)
- `canPriority` = `incident.update`
- `canAssign` = `incident.assign`
`defaultView` = `sp.view` o "mine" si es `support_agent` con member id, si no "all".

**5. Pantalla:** `NewIncidentButton` (`components/incidents/new-incident-button.tsx`),
`IncidentStats` (`components/incidents/incident-stats.tsx`: donut por prioridad con conic-gradient,
top categorias, contador de candidatos a Evolucion — `inc.evolution.candidate`) e
`IncidentSplit` (`components/incidents/incident-split.tsx`): tabla `IncidentTable` a la izquierda +
panel **Preview** al seleccionar fila (sin queries nuevas). Preview muestra SLA, responsable
(`flt.responsible`/`inc.view.unassigned`), BU, app, estado, apertura, prioridad, y botones
contextuales: **Resolver** (`inc.action.resolve` con confirm), **Enviar a Evolucion**
(`inc.action.evolve` con confirm), setPriority, asignar. Enlace `inc.open` al detalle. Estados
via `StatusPill`/`PriorityTag`/`ScoreBadge`. Filtros y vistas guardadas (`savedViews`).

**6. Funcional/tecnico:** Carga en paralelo `listIncidents` (`lib/incidents/queries.ts` — select de
`incident` con joins category/ci/business_unit/assignee/reporter, orden por
`transformation_score` desc), `getCaseTypeMeta`, `getMyMemberId`, `getAccessControl`,
`getAssignableMembers` (`lib/talent/queries`), `listSavedViews` (`lib/views/queries`, scope
"incidents"). Acciones (client, en `IncidentSplit`): `changeStatus`, `sendToEvolution`, `setPriority`
(`lib/incidents/actions.ts`), `assignIncidentMember` (`lib/talent/actions`). `setPriority` valida en
servidor `incident.assign` OR `triage.manage` y prioridad en lista blanca; `sendToEvolution` exige
`incident.assign` OR `triage.manage`, pone `status=in_evolution`, `transformation_candidate=true`,
inserta comentario de sistema visibilidad `partner` y notifica al `product_owner` via RPC
`notify_role`. Auditado por trigger de BD.

**7. Flujos clave:** (a) Filtrar/seleccionar caso -> Preview -> Resolver o Enviar a Evolucion.
(b) Cambiar prioridad/asignar desde el Preview. (c) `NewIncidentButton` -> `/incidents/new`.

---

## 4. /incidents/[id] — Detalle de incidencia (expediente 360)

**1. Ruta y parametros:** `/incidents/[id]` (`id` = uuid del incidente).
Archivo: `app/(app)/incidents/[id]/page.tsx`.

**2. Modulo / categoria:** Macro **Tickets**, sub-ruta de `nav.incidents` (perm de ruta
`incident.read` por prefijo).

**3. Proposito:** Expediente completo del caso: es el centro de tracking client-centric (§0). Reune
en una pantalla comunicacion, SLA, triage, asignacion, conocimiento, y todos los vinculos de
gobierno (problema, cambio, incidente mayor, proyecto de Evolucion, riesgo, fraude/disputa, CSAT,
workflows). Sobrevive la transicion incidencia->evolucion (ancla `in_evolution`).

**4. Roles y permisos:** ver requiere `incident.read`. `can(code)` (admin OR perm) habilita paneles:
`risk.manage`, `problem.manage`, `workflow.run`, `change.manage`, `major_incident.manage`,
`incident.update`, `triage.manage`, `worklog.manage`, `survey.submit`, `fraud.manage`,
`dispute.manage`, `talent.manage`, y `incident.assign` OR `triage.manage` para asignar.

**5. Pantalla:** Componente `components/incidents/detail/incident-detail.tsx` (~432 lineas) con
subcomponentes en `components/incidents/detail/`:
- Cabecera con `PriorityTag`, badge de incidente mayor (`mi.badge.major`), badge duplicado
  (`dup.is_duplicate_of`), `StatusStepper` (flujo de estados) y `StatusActions` (transiciones).
- **TriagePanel** (si aplica), **CaseTasks** (tareas), **Attachments** (adjuntos), **CommentThread**
  (`inc.section.timeline` — hilo de comunicacion), **AssignResponsible** + **EvaluateMemberPanel**.
- **SlaStatusRow** (respuesta/resolucion), **RecurrenceReview**.
- Grupos colapsables (`MoreGroup`/`Collapsible`): Escalados SLA (`IncidentEscalations`), WorkLog,
  CSAT (`CsatPanel`), Vinculos (`inc.group.links`): DeclareMi (incidente mayor), Conocimiento,
  Duplicados (`DuplicatesPanel`), Problema (`ProblemLink`), Cambio (`ChangeLink`), Workflows
  (`IncidentWorkflows`), Caso financiero (`FinancialCaseLink`), Proyectos, Riesgo (`RiskLink`).
- Grupo IA: `EvaluatePanel`, **EvolutionPanel**, `AiRca` (RCA), `AiInsights`, `AiExecSummary`, `AiKb`.

**6. Funcional/tecnico:** `getIncident` (select `*` con joins) + `Promise.all` masivo de ~22 queries
de dominio: `getComments`, `getLedgerForEntity` (immutable_audit_event), `getSuggestedKnowledge`,
`getRiskEventForIncident`, `getProblemsForIncident`, `getEscalationsForIncident`,
`getWorkflowsForIncident`/`getActiveDefinitions`, `getChangesForIncident`,
`getMajorIncidentForIncident`, `getVendorForIncidentCi`, `getIncidentEffort`, `getCsatForIncident`,
`getFinancialCaseForIncident`, `getAttachments`/`getTasks` (`lib/casework/queries`),
`getAssignableMembers`, `getProjectsForIncident`, `listMacros`, `getAssignees`, `getCaseTypeMeta`,
`getDuplicateLinks`. Acciones: `changeStatus`, `resolveIncident`, `softDeleteIncident`,
`sendToEvolution`, `addComment`, `setPriority`, `markDuplicate`/`revokeDuplicate`,
`setIncidentRecurrence` (`lib/incidents/actions.ts`); EvolutionPanel llama `sendToEvolution`
(`inc.evolution.send`). Todas backend-authoritative con guard de permiso; auditadas por trigger.

**7. Flujos clave:** (a) Responder al cliente en el hilo (`addComment`). (b) Resolver el caso
(`StatusActions` -> `resolveIncident`). (c) Enviar a Evolucion (EvolutionPanel/StatusActions).
(d) Declarar incidente mayor (DeclareMi). (e) Vincular problema/cambio/proyecto.

---

## 5. /incidents/[id]/edit — Editar incidencia

**1. Ruta y parametros:** `/incidents/[id]/edit`. Archivo: `app/(app)/incidents/[id]/edit/page.tsx`.

**2. Modulo / categoria:** Macro **Tickets**, sub-ruta de `nav.incidents` (perm de ruta
`incident.read`; la mutacion valida `incident.update` en el server action).

**3. Proposito:** Formulario de edicion del caso existente (clasificacion, activos afectados, capa
fintech, impacto/urgencia). Reusa el mismo formulario que el alta, en modo `edit`.

**4. Roles y permisos:** ruta bajo `incident.read`; `updateIncident` valida permisos en servidor.

**5. Pantalla:** `IncidentForm` (`components/incidents/incident-form.tsx`) con `mode="edit"`,
`incidentId` e `initial` precargado desde el caso. Mismas secciones que el alta (ver /incidents/new).

**6. Funcional/tecnico:** `getIncident` + `getFormOptions` en paralelo; `notFound()` si no existe.
`initial` mapea columnas del incidente a `IncidentInput` (title, description, categoryId,
affected*Id, impact, urgency, financialImpactEstimate, caseType, amount, currency,
transaction_reference, customer_name, sensitive_flag, pii_flag). Mutacion: `updateIncident(id, input)`
(`lib/incidents/actions.ts`).

**7. Flujos clave:** Abrir desde el detalle -> ajustar campos -> guardar (updateIncident) -> volver.

---

## 6. /incidents/new — Alta de incidencia (staff)

**1. Ruta y parametros:** `/incidents/new`. Archivo: `app/(app)/incidents/new/page.tsx`.

**2. Modulo / categoria:** Macro **Tickets**, sub-ruta de `nav.incidents`. Quick action del Command
Menu `qa.newIncident` (visible con `incident.read`; el usuario final reporta por `/portal`).

**3. Proposito:** Formulario para que el staff registre un caso nuevo, con asistencia anti-duplicado
(casos similares, KB, busqueda semantica) antes de crear. Evita duplicados y sugiere soluciones ya
conocidas.

**4. Roles y permisos:** ruta bajo `incident.read`. `createIncident` valida en servidor
(`incident.create` OR `incident.update` OR `incident.resolve` OR `triage.manage`).

**5. Pantalla:** `IncidentForm` (`mode="create"`). Secciones (claves i18n):
`inc.section.classification` (titulo, descripcion, categoria OPCIONAL, impacto, urgencia, prioridad
calculada `inc.priority.computed`), panel de similares con analisis IA (`similar.*`: candidatos,
misma categoria/app, ver), busqueda de resueltos (`similar.resolved.*`) y semantica (`similar.sem.*`),
sugerencias KB (`portal.kb.*`) y casos (`portal.cases.*`); `inc.section.affected` (app, servicio,
producto, canal, unidad de negocio, impacto financiero); `inc.section.fintech` (tipo de caso, monto,
moneda, referencia de transaccion, cliente, flags sensibles/PII).

**6. Funcional/tecnico:** `getFormOptions(ctx.supabase)` provee catalogos reales (categorias, apps,
servicios, productos, canales, unidades, tipos de caso) — sin hardcode. Acciones desde el form:
`createIncident`, `updateIncident`, `checkSimilarCases`, `searchResolvedSimilar`,
`findSimilarSemantic` (`lib/incidents/actions.ts`), `refineSimilarAtIntake` (`lib/ai/analysis`).
`createIncident` deriva prioridad de impacto/urgencia (`derivePriority`; sube un nivel si es
reincidencia `bumpPriority`), inserta en `incident` con `tenant_id`, `status="new"`, columnas
fintech; dispara embedding semantico fire-and-forget (`triggerIncidentEmbedding`). Retorna numero y
compromisos SLA (opened/response/resolution due). Auditado por trigger.

**7. Flujos clave:** (a) Escribir titulo/descripcion -> revisar similares/KB -> completar afectados y
fintech -> crear. (b) Si un similar aplica, abrirlo en vez de duplicar.

---

## 7. /triage — Cola de admision (intake)

**1. Ruta y parametros:** `/triage`. Sin parametros. Archivo: `app/(app)/triage/page.tsx`.

**2. Modulo / categoria:** Macro **Tickets**, item `nav.triage`, perm **`triage.manage`**. En la
persona Operaciones (`OPERATIONS_NAV`) esta en el grupo "Casos".

**3. Proposito:** Bandeja de casos aun sin triar (`intake_status = pending`). La mesa admite y
clasifica cada caso: Incidencia (va a Operaciones), Mejora/Proyecto (va a Evolucion como ancla), o
resuelto directo con KB; tambien puede descartar con motivo. Es el filtro de entrada de la mesa.

**4. Roles y permisos:** ruta y acciones requieren `triage.manage`. `canManage` se pasa a la cola.

**5. Pantalla:** `TriageQueue` (`components/triage/triage-queue.tsx`). Intro `tri.queue.intro`;
filtros por categoria y app (`FilterBar`); tabla con `inc.col.number/title/category/app`,
`tri.col.received`, `tri.col.actions`; edad del caso con colores (24h/72h). Acciones por fila:
**Admitir** (`tri.act.admit` -> `acceptCase(id,"incident")`) y **Descartar** (`tri.act.discard` ->
prompt de motivo -> `discardCase`). Mensajes `tri.act.admitted`/`tri.act.discarded`/`tri.act.error`.
Estado vacio `tri.queue.empty`. Existe ademas `TriagePanel` (`components/triage/triage-panel.tsx`),
el protocolo de admision detallado embebido en el detalle del caso: decision binaria Incidencia
(`ops`) vs Evolucion (`evo` -> Mejora `improvement`/Proyecto `project`), opcion KB, o descartar.

**6. Funcional/tecnico:** `listPendingCases` (`lib/triage/queries.ts`: `incident` where
`intake_status='pending'`, orden por `opened_at` asc). Acciones `acceptCase`/`discardCase`
(`lib/triage/actions.ts`) con `guard()` que exige `triage.manage`. `acceptCase`:
- Si clasifica a Evolucion (`routesToEvolution`): `status=in_evolution`,
  `transformation_candidate=true`, `transformation_decision='to_evolution'`, setea
  `delivery_area_id` del area `evolution`, inserta comentario de sistema visibilidad `partner`.
- Si hay `kbArticleId`: `status=resolved`, `resolution_code='kb_match'`, comentario de sistema.
- Si no: `status=received` (sin asignar), comentario "Pendiente de asignar".
Cada rama registra `triaged_by`/`triaged_at`. Auditado por trigger.

**7. Flujos clave:** (a) Admitir como incidencia -> pasa a Operaciones (received). (b) Clasificar como
Mejora/Proyecto -> Evolucion, la mesa mantiene tracking (in_evolution). (c) Resolver con KB.
(d) Descartar con motivo (queda registrado como resuelto).

---

## 8. /major-incidents — Incidentes mayores (lista / war-room)

**1. Ruta y parametros:** `/major-incidents`. Archivo: `app/(app)/major-incidents/page.tsx`.

**2. Modulo / categoria:** Macro **Tickets**, item `nav.majorincidents`, perm `major_incident.read`.
`support_lead` conserva acceso (declara el estado inline y comanda el war-room) aunque salio del menu;
en la persona Evolucion aparece como `nav.evx.majorinc`.

**3. Proposito:** Listado de incidentes mayores (crisis) con KPIs y estado de comunicaciones. Da
visibilidad de las crisis activas, su severidad, comandante y si la proxima actualizacion esta
vencida. Punto de entrada al war-room.

**4. Roles y permisos:** ver `major_incident.read`. Gestion (`major_incident.manage`) se evalua en
el detalle.

**5. Pantalla:** `MiList` (`components/major-incidents/mi-list.tsx`). KPIs `mi.kpi.active`,
`mi.kpi.sev1`, `mi.kpi.overdue`. Filtros/agrupacion por severidad, estado, comandante
(`FilterBar`/`GroupBar`). Tabla `mi.col.number/sev/title/commander/nextupdate/status` con
`SevBadge`/`MiStatusBadge`; marca overdue si `next_update_due_at` vencio y no esta resolved/stood_down.
Estado vacio `mi.empty`. Filas enlazan a `/major-incidents/[id]`.

**6. Funcional/tecnico:** `listMajorIncidents` (`lib/major-incidents/queries.ts`) devuelve
`{incidents, stats:{active, sev1, commsOverdue}}`. Solo lectura.

**7. Flujos clave:** Ver crisis activas -> abrir el war-room del MI.

---

## 9. /major-incidents/[id] — War-room del incidente mayor

**1. Ruta y parametros:** `/major-incidents/[id]`. Archivo: `app/(app)/major-incidents/[id]/page.tsx`.

**2. Modulo / categoria:** Macro **Tickets**, sub-ruta de `nav.majorincidents`.

**3. Proposito:** Sala de comando (war-room) de la crisis: linea de tiempo de actualizaciones,
evidencia, mando (comandante/comms lead), y avance de estado. Coordina la respuesta y la comunicacion
durante un incidente mayor, con ledger inmutable de acciones.

**4. Roles y permisos:** `canManage` = `hasPermission("major_incident.manage")` habilita postear
updates, cambiar estado, subir evidencia, reabrir. Solo editable con el MI **activo**
(`isMiEditable`); cerrado = solo lectura salvo reabrir.

**5. Pantalla:** `MiDetail` (`components/major-incidents/mi-detail.tsx`). Secciones:
avance de estado (`mi.advance` -> `changeMiStatus`), bridge (`mi.bridge`), post de actualizacion
(`mi.post.*` -> `postUpdate` con tipo y minutos a proxima), timeline (`mi.timeline`/`mi.noupdates`),
mando (`mi.command`: comandante **fijo por rol y no editable** `mi.commander.locked`, comms lead),
metadatos (`mi.declared/nextupdate/resolved/impact/source`), evidencia (`mi.evidence.*` ->
`uploadMiEvidence`/`deleteMiEvidence`) y **Ledger** (`inc.section.ledger`, `immutable_audit_event`).
Modo solo lectura muestra `mi.readonly.*` con boton **Reabrir** (`mi.reopen` -> `reopenMajorIncident`).

**6. Funcional/tecnico:** `getMajorIncident` + `Promise.all`: `getMajorIncidentUpdates`,
`getCommandOptions`, `getLedgerForEntity`, `hasPermission("major_incident.manage")`,
`getMiCommanders`, `getMajorIncidentEvidence`. Comandante derivado del rol (§11): Gerencia de
Operaciones por defecto; Lider de Evolucion si el caso ya paso a Evolucion (`pickCommander` +
`isCaseInEvolution`). Acciones (`lib/major-incidents/actions.ts`): `postUpdate`, `changeMiStatus`,
`assignCommand`, `uploadMiEvidence`, `deleteMiEvidence`, `reopenMajorIncident`. La declaracion
(`declareMajorIncident`, disparada desde el detalle del incidente via `DeclareMi`) fija el comandante
`support_lead`, crea `major_incident` (status `declared`), inserta primer update y notifica por
`notify_role` a `support_lead` y `product_owner`.

**7. Flujos clave:** (a) Postear actualizacion con proxima ventana. (b) Avanzar estado del MI.
(c) Subir evidencia. (d) Reabrir un MI cerrado.

---

## 10. /service-catalog — Catalogo de servicios (+ Gobierno SLA)

**1. Ruta y parametros:** `/service-catalog`. Sin parametros.
Archivo: `app/(app)/service-catalog/page.tsx`.

**2. Modulo / categoria:** Macro **Tickets**, item `nav.servicecatalog`, perm `service_catalog.read`.
En Operaciones es la pantalla fusionada "Catalogo y SLA"; para el usuario final/operador es
"Catalogo" (solicitante).

**3. Proposito:** Catalogo de items de servicio que el usuario puede solicitar, con seguimiento de
sus solicitudes. Para quien tiene `sla.read` agrega la pestana "Gobierno SLA" (reusa Governance).
Un solicitante sin gestion ve solo sus solicitudes.

**4. Roles y permisos:** ver `service_catalog.read`. En la page:
- `canRequest` = `service_catalog.request`
- `canManage` = `service_catalog.manage` (ve todas las solicitudes + maestro de categorias)
- `canSla` = `sla.read` **y no** vedado por denylist de `/sla-governance` (el operador tiene
  `sla.read` pero /sla-governance le esta vedado -> no ve Gobierno SLA embebido)
- `canManageSla` = `sla.manage`

**5. Pantalla:** `ServiceManagement` (`components/service/service-management.tsx`): si `sla` es null
renderiza solo `ServiceCatalog` (`components/catalog/service-catalog.tsx`); si hay SLA, `TabbedScreen`
con pestanas `nav.servicecatalog` (Catalogo) y `nav.sla` (Governance de `components/sla/governance.tsx`).
El catalogo lista items, permite solicitar (si `canRequest`), muestra estadisticas de solicitudes y,
para gestor, el maestro de categorias.

**6. Funcional/tecnico:** En paralelo (`lib/catalog/queries.ts` + `lib/sla/queries.ts`):
`listCatalogItems`, `listRequests(ownerId, ownOnly=!canManage)`, `listCatalogItems(true)` y
`listServiceCategories(true)` solo para gestor, y el bloque SLA (`getAtRiskIncidents`,
`listEscalationEvents`, `listEscalationRules`, `listOlaPolicies`, `getSlaFormOptions`) solo si
`canSla`. Accion de solicitud `submitRequest` (`lib/catalog/actions.ts`): **atomica** via RPC
`create_service_request` que crea el **incidente ancla + la solicitud** en una transaccion, y dispara
el workflow del item (`start_workflow`) si define uno. Gestion: `fulfillRequest`, `cancelRequest`,
`createItem`, `createCategory`, `setCategoryStatus`, `setItemStatus`.

**7. Flujos clave:** (a) Solicitante: elegir item -> completar form -> `submitRequest` (crea caso
ancla). (b) Gestor: cumplir/cancelar solicitudes; administrar items y categorias. (c) Con SLA:
revisar gobierno en la 2a pestana.

---

## 11. /service-catalog/requests/[id] — Detalle de solicitud de servicio

**1. Ruta y parametros:** `/service-catalog/requests/[id]`.
Archivo: `app/(app)/service-catalog/requests/[id]/page.tsx`.

**2. Modulo / categoria:** Macro **Tickets**, sub-ruta de `nav.servicecatalog`.

**3. Proposito:** Detalle de una solicitud de servicio: datos del formulario, SLA, estado, caso ancla
vinculado. El gestor la cumple/cancela; el propietario consulta su solicitud.

**4. Roles y permisos:** `canManage` = `service_catalog.manage`; `canViewIncident` = `incident.read`.
Seguridad anti-IDOR: sin gestion, **solo el propietario** (`requested_by_user_id === accountId`)
puede abrirla; si no, `notFound()` (reforzado por RLS por propietario en `service_request`).

**5. Pantalla:** `RequestDetail` (`components/catalog/request-detail.tsx`). Muestra numero, estado
(`StatusPill`), solicitante (`cat.requester`), vencimiento SLA (`cat.col.due`), datos del formulario
(render por `form_schema`), enlace al caso ancla (`cat.anchor`, si `canViewIncident`). Acciones de
gestor: **Cumplir** (`cat.fulfill` -> `fulfillRequest`) y **Cancelar** (`cat.cancel` ->
`cancelRequest`), con mensajes ok/err traducidos.

**6. Funcional/tecnico:** `getRequest` (`lib/catalog/queries.ts`) + `hasPermission` x2. Acciones
`fulfillRequest` (marca fulfilled y resuelve el caso ancla, habilita CSAT) / `cancelRequest`
(`lib/catalog/actions.ts`). Backend-authoritative.

**7. Flujos clave:** (a) Gestor: abrir solicitud -> Cumplir/Cancelar. (b) Propietario: consultar
estado y datos de su solicitud.

---

## 12. /portal — Hub de autoservicio del usuario final

**1. Ruta y parametros:** `/portal` (pestanas via `?tab=inicio|miscasos|...`).
Archivo: `app/(app)/portal/page.tsx`.

**2. Modulo / categoria:** Macro **Tickets**, item `nav.selfservice` (sin perm = libre). Es el
**hub unico** del usuario final (`partner_user`), con nav plano (`USER_NAV`/`USER_PORTAL_MENU`) y
tema Claro por defecto. `defaultHome` sin perms -> `/portal`.

**3. Proposito:** Portal donde el usuario final registra casos, busca en la base de conocimiento y
consulta sus casos. Client-centric: reportar en lenguaje natural con asistencia (voz, KB, deteccion
de duplicados/reincidencia) y seguimiento de sus casos activos.

**4. Roles y permisos:** ruta libre (autenticado). En la page: `canFeedback` = `knowledge.feedback`;
`canViewIncidents` = `incident.read`. La creacion la autoriza `createIncident` en servidor
(`incident.create`).

**5. Pantalla:** `Portal` (`components/portal/portal.tsx`, ~577 lineas). Pestanas: **Inicio** (hero
`portal.welcome`, CTAs Registrar `portal.register` y Mis casos), **Autoservicio/Registrar**
(`portal.intake.*`: asunto con dictado por voz `portal.voice`, seleccion de app, categoria auto,
urgencia segmentada `UrgencySegmented`, prioridad estimada, evidencia `EvidenceDropzone`), y
**Mis casos** (`CaseInbox` con grupos accion-requerida/resueltos, busqueda). Tiras de sugerencias
(`SuggestionsStrip`), bloque de duplicados/reincidencia (`DuplicateBlock`/`TrendingAggregators`/
`ResolvedBefore`), confirmacion (`CaseCreated`). Estado vacio `portal.mycases.empty`.

**6. Funcional/tecnico:** En paralelo (`lib/portal/queries.ts`): `listPortalCategories`,
`listApplications`, `getMyReportedCases(accountId)`, `getCaseTypeMeta`, `getMyActivity`,
`getAccessControl`. Acciones (client): `createIncident` (`lib/incidents/actions.ts`) con
`impact=INTAKE_IMPACT` y urgencia elegida; `checkMySimilarCases`; `searchKb` (`lib/portal/assist`);
`uploadMyCaseEvidence` (`lib/portal/case-actions`); `getReportAggregators`/`joinAsChildCase`/
`reportRecurrence` (`lib/portal/duplicates` — unirse a caso padre o reportar reincidencia). El caso
se crea con `reported_by_user_id = accountId`. i18n ES/EN.

**7. Flujos clave:** (a) Registrar caso: escribir asunto (o dictar) -> ver KB/duplicados -> elegir
app/urgencia/evidencia -> `createIncident` -> confirmacion. (b) Unirse a un caso existente / reportar
reincidencia. (c) Ir a Mis casos y abrir el detalle.

---

## 13. /portal/cases/[id] — Detalle del caso propio (usuario final)

**1. Ruta y parametros:** `/portal/cases/[id]`. Archivo: `app/(app)/portal/cases/[id]/page.tsx`.

**2. Modulo / categoria:** Macro **Tickets**, bajo `/portal` (ruta libre). El acceso **no** depende
de `incident.read`: la propiedad la impone la RPC `get_my_case` (`reported_by_user_id` = cuenta).

**3. Proposito:** Vista del caso propio del usuario final: hilo de comunicacion con la mesa,
progreso, SLA, evidencia, escalar y encuesta CSAT. Es la ventana client-centric del reportante.

**4. Roles y permisos:** libre para el propietario; `getMyCase` devuelve null (=> `notFound()`) si el
caso no es suyo. Ownership enforced por RPC + RLS.

**5. Pantalla:** `UserCaseDetail` (`components/portal/user-case-detail.tsx`). Cabecera con estado;
bloque "quien atiende" (`case.attends.*`) y escalar (`case.escalate.cta` -> `escalateMyCase`);
responder al hilo (`case.reply.*` con dictado por voz) y agregar evidencia (`case.evidence.add`);
progreso (`case.progress.title`), detalle del caso (app/servicio/producto/canal/BU), historial del
hilo (`case.history.title`: yo/sistema/mesa), nota de reincidencia/evolucion, cuando estara
(`case.when.*`), SLA (`case.sla.*`).

**6. Funcional/tecnico:** `getMyCase` + `Promise.all`: `getMyCaseThread`, `getMyCaseSurvey`,
`getMyCaseAttachments` (`lib/portal/case-queries.ts`). Acciones (`lib/portal/case-actions.ts`):
`addMyCaseComment`, `submitCaseCsat`, `uploadMyCaseEvidence`, `deleteMyCaseEvidence`,
`escalateMyCase`. Solo opera sobre el caso propio. i18n ES/EN.

**7. Flujos clave:** (a) Responder a la mesa en el hilo. (b) Adjuntar evidencia. (c) Escalar el caso.
(d) Responder la encuesta CSAT cuando esta resuelto.

---

## 14. /partner — Portal de organizacion (party) [gateado a staff]

**1. Ruta y parametros:** `/partner`. Sin parametros. Archivo: `app/(app)/partner/page.tsx`.

**2. Modulo / categoria:** El item `nav.partner` fue **retirado del menu** (UX-007: el usuario final
tiene un solo hub `/portal`). Ruta gateada: `ROUTE_PERMISSIONS` exige **`incident.read`** (staff),
por lo que `partner_user` externo ya no puede abrirla por URL.

**3. Proposito:** Vista de los tickets de una organizacion (party): KPIs (abiertos/resueltos/total) y
listado de tickets de esa party. Es una vista de datos de partner para staff. (El portal de partner
externo por organizacion se reintroducira con gating por party en su fase — no verificado como activo.)

**4. Roles y permisos:** requiere `incident.read` (staff). Los datos se acotan a `ctx.partyId`.

**5. Pantalla:** `PartnerPortalView` (`components/partner/partner-portal.tsx`). Si no hay party
vinculada: estado honesto (`pp.noorg.*`) con CTAs a `/portal` y `/knowledge` (sin datos demo). Con
party: cabecera con acento de marca (rojo Credix por defecto o `brand_accent` de la party), KPIs
`pp.kpi.open/resolved/total`, tabla de tickets (`pp.mytickets`, `StatusPill`), bloque de
autoservicio (`pp.selfservice`) y gobernanza (`pp.governance`). Estado vacio `pp.empty`.

**6. Funcional/tecnico:** `getPartnerPortal(ctx.supabase, ctx.partyId)` (`lib/partner/queries.ts`):
carga la `party` del usuario y los `incident` con `affected_party_id = partyId` (sin fallback a datos
demo, UX-019). Solo lectura. KPIs calculados en memoria.

**7. Flujos clave:** (a) Ver KPIs y tickets de la organizacion. (b) Sin organizacion -> ir a
autoservicio/KB.

---

## Indice de pantallas documentadas

1. `/dashboard` — Command Center (torre operativa)
2. `/workspace` — Espacio del agente (colas)
3. `/incidents` — Lista de incidencias (split master-detail)
4. `/incidents/[id]` — Detalle de incidencia (expediente 360)
5. `/incidents/[id]/edit` — Editar incidencia
6. `/incidents/new` — Alta de incidencia (staff)
7. `/triage` — Cola de admision (intake)
8. `/major-incidents` — Incidentes mayores (lista)
9. `/major-incidents/[id]` — War-room del incidente mayor
10. `/service-catalog` — Catalogo de servicios (+ Gobierno SLA)
11. `/service-catalog/requests/[id]` — Detalle de solicitud de servicio
12. `/portal` — Hub de autoservicio del usuario final
13. `/portal/cases/[id]` — Detalle del caso propio (usuario final)
14. `/partner` — Portal de organizacion (party) [gateado a staff]

---

## Hallazgos transversales del cluster

1. **Patron page.tsx uniforme (RSC + Promise.all + gate por permiso):** cada page es un Server
   Component que hace `getContext()`/`getAccessControl()`, corta con `if (!ctx) return null` o
   `notFound()`, carga datos en paralelo con `Promise.all` y pasa `can*` booleanos calculados por
   permiso a un unico componente cliente. Los permisos se resuelven una sola vez (cache por request);
   el detalle de incidencia comenta explicitamente haber colapsado 11 RPC `has_permission` a esto.

2. **Doble/triple capa de autorizacion coherente:** el `perm` del item de nav == `ROUTE_PERMISSIONS`
   (guard de ruta) == guard del server action (`anyPerm`/`guard`). Ademas hay segregacion por persona
   (`ROLE_ROUTE_DENY` + `solePersona`) que bloquea rutas aunque el rol tenga el permiso amplio, y
   ownership anti-IDOR reforzado por RLS (portal cases, service requests, partner por `partyId`). Las
   acciones son backend-authoritative (no confian solo en el gate de UI).

3. **Tracking client-centric y transicion incidencia->evolucion como estado, no cierre:** `acceptCase`
   y `sendToEvolution` ponen `status=in_evolution` (ancla, no `closed`), fijan
   `transformation_candidate/decision`, insertan comentario de sistema visibilidad `partner` y
   notifican al `product_owner`. El hilo de comunicacion sobrevive (mismo `incident_comment` en
   /incidents/[id], /portal/cases/[id] y triage). Materializa el principio §0 del CLAUDE.md.

4. **Cero hardcode + audit-grade consistentes:** los selects/opciones vienen de catalogos reales
   (`getFormOptions`, `listPortalCategories`, `getCaseTypeMeta`, etc.), sin listas quemadas; todo copy
   es i18n ES/EN via `t()`. Toda pantalla con entidad de negocio expone/consume
   `immutable_audit_event` (ledger) y las mutaciones se auditan por trigger de BD. Operaciones
   compuestas usan RPC transaccional (p.ej. `create_service_request` crea caso ancla + solicitud
   atomicamente). Estados honestos sin datos demo (partner sin party, workspace/listas con empty state).

5. **Riesgos / puntos de atencion (no verificados a fondo):**
   - El detalle `/incidents/[id]` dispara un `Promise.all` de ~22 queries de dominio: costo/latencia
     alto y acoplamiento a muchos modulos; cualquier query que lance error rompe toda la pagina
     (varios `throw new Error` en queries).
   - `/partner` quedo gateado a `incident.read` y fuera del menu; su proposito de "portal de partner
     externo" no esta activo (pendiente de fase con gating por party) — la pantalla existe pero su rol
     funcional real es ambiguo hoy.
   - La cobertura E2E (Playwright, exigida por CLAUDE.md §3.2 #8) no se valido en esta documentacion.


---

# Clúster B — Operaciones + Analítica

# Manual tecnico — CLUSTER B: Operaciones + Analitica + Clientes/Fraude/Riesgo

> Documentacion basada en el codigo real del repositorio Credix Nexus (Next.js 16 App Router + Supabase).
> Toda afirmacion sale de `page.tsx`, componentes, `lib/*/queries.ts`, `lib/*/actions.ts` y `sql/*`.
> Lo no verificable contra el codigo se marca `(no verificado)`.
> i18n: todo copy visible sale de `lib/i18n/dictionaries.ts` via `useI18n()` (`t(clave)`), ES/EN.

## Indice de pantallas

1. `/operaciones` — Torre de Control de Operaciones (3 pestanas: Resumen / Operacion / Analitica)
2. `/sla-governance` — Gobierno SLA/OLA
3. `/customers` — Clientes (lista)
4. `/customers/[id]` — Cliente 360
5. `/fraud-disputes` — Fraude y Disputas (2 pestanas)
6. `/fraud-disputes/fraud/[id]` — Detalle de caso de fraude
7. `/fraud-disputes/dispute/[id]` — Detalle de caso de disputa
8. `/risk` — Riesgo operativo
9. `/analytics` — Analitica (5 pestanas)
10. `/analytics/comportamiento` — Analisis de comportamiento agregado
11. `/casos-convertidos` — Casos convertidos (trazabilidad incidencia -> proyecto)
12. `/cola-equipo` — Cola del equipo (solo lectura, rol Operador)

---

## Nota transversal: guard de acceso (aplica a todas las rutas del cluster)

`app/(app)/layout.tsx` aplica dos candados antes de renderizar cualquier hijo:

1. **Guard por permiso de ruta:** `requiredPermForPath(pathname)` (de `lib/nav/access.ts`, mapa `ROUTE_PERMISSIONS`). Si la ruta requiere un permiso que el usuario no tiene -> `redirect("/unauthorized")`. Admin (`isAdmin`) nunca se bloquea.
2. **Segregacion por persona:** `isRouteDeniedForRoles(pathname, roleList)` (denylist `ROLE_ROUTE_DENY`). Solo aplica a usuarios de UNA sola persona interna (`solePersona`). Admin exento.

El menu lateral se arma con `navForRoles(roles, isAdmin)` (`lib/nav/navigation.ts`): overlay de persona para persona unica, `MACRO_NAV` para multi-persona/admin, `USER_NAV` para `partner_user`. `canSeeNav` filtra cada item por su `perm`.

---

## 1. `/operaciones` — Torre de Control de Operaciones

**Archivo:** `app/(app)/operaciones/page.tsx` · Componente: `components/operations/operations-tower.tsx`
**Queries:** `lib/operations/queries.ts`, `lib/analytics/queries.ts`

### 1. Ruta y parametros
- Ruta `/operaciones`. `searchParams`: `?dim=` (dimension de comportamiento) y `?weeks=` (ventana), ademas de `?tab=` (pestana de la Torre) que gestiona el componente cliente.
- `dim` se normaliza con `normalizeDimension` (default `category`). `weeks` se acota a `[4, 52]` (default 12): `Math.min(52, Math.max(4, parseInt(weeks) || 12))`.

### 2. Modulo/categoria
- Categoria macro **Operaciones** (`nav.macro.operaciones`, icono `sliders`). Item `nav.ophome` -> `/operaciones`, `perm: "incident.read"`.
- En la persona **Gerente de Operaciones** (`support_lead`, `OPERATIONS_NAV`) es el grupo/pantalla **Torre** (`op.torre`) y es el default del rol. La Analitica y el Analisis de comportamiento se absorben aqui como la 3a pestana (Fase B).

### 3. Proposito
Cockpit del Gerente de Operaciones: "decision primero, inventario despues". Unifica en una pantalla la Torre (linea de estado + bandeja priorizada de decisiones + pipeline + KPIs) con las metricas del ex-dashboard ejecutivo y toda la Analitica. Su objetivo es que el lider sepa, de un vistazo, que requiere su decision (MI, SLA vencido, admitir, asignar, derivar) y como esta la operacion, sin perder el tracking client-centric.

### 4. Roles y permisos
- Acceso de ruta: `incident.read` (`ROUTE_PERMISSIONS` prefix `/operaciones`).
- La pestana **Analitica** depende de `analytics.read`: los RPC (`getPerformance`, `getCategoryTrends`, `getRecurrenceAnalytics`, `getBehaviorAnalysis`) gatean por ese permiso. Si el rol no lo tiene o falla, `analytics = null` y la pestana muestra `AnalyticsUnavailable` (degradacion resiliente sin tumbar la Torre; `try/catch` en la page). `sql/0109_support_lead_analytics_read.sql` otorga `analytics.read` al `support_lead`.
- `support_agent` tiene `/operaciones` en su `ROLE_ROUTE_DENY` -> 403 por URL.

### 5. Pantalla (secciones/paneles)
El componente `OperationsTower` renderiza:
- **A) Hero compacto:** saludo por hora (`op.tw.greet.*`, calculado en cliente para evitar mismatch de hidratacion) + `StatusChips` (chips con conteos: pendiente admision, sin asignar, SLA incumplido, MI comunicacion vencida; cero atenuado).
- **B) "Requiere tu decision":** rejilla 2x2 de `DecisionRow` (bandeja priorizada). Estado vacio: `EmptyState` con check (`op.tw.decide.empty`). Cada fila muestra icono, conteo grande, etiqueta y CTA con deep-link. Meta `DECISION_META` mapea 5 tipos: `mi_comm` (war-room), `sla_breach` (intervenir), `intake` (admitir), `assign` (asignar), `derive` (derivar).
- **C) Franja Operacion:** 4 KPIs (Backlog con sparkline de ingreso + hoy/delta, Sin asignar, SLA incumplido, Resueltos 30d con % reapertura). Fuentes unificadas para evitar el mismo concepto con numeros distintos (integridad §10).
- **D) Tabs con deep-link `?tab=`:** 3 pestanas (`resumen` | `operacion` | `analitica`).

**Pestana Resumen:** Pipeline (`op.tw.pipeline`), Inventario (`KpiGrid` con `dashboard_counts`) y Bandeja por accion (`CaseInbox` con 3 grupos: activas/evolucion/observacion).
**Pestana Operacion:** Funnel por estado, Workload por agente (top 12), KPIs ITSM (5, en una fila), y Aging del backlog (barras por bucket).
**Pestana Analitica:** embebe `<Analytics>` completo + `<BehaviorAnalysisView basePath="/operaciones">`. Si `analytics == null` -> `AnalyticsUnavailable`.

**Acciones/enlaces:** todo navega por deep-link. Ej.: DecisionRow -> `/major-incidents`, `/sla-governance`, `/triage`, `/incidents`, `/incidents?view=candidates`. KPIs -> `/incidents?view=unassigned|sla`. Pipeline -> `/incidents?status=<key>` salvo `in_evolution` -> `/casos-convertidos`. Bandeja: filas -> `/incidents/[id]`.

### 6. Funcional/tecnico
**`getOperationsTower(supabase)`** (composicion de lecturas, sin RPC nuevo): lee 3 tablas via cliente RLS-scoped:
- `incident` (id, status, priority, intake_status, assigned_user_id, assigned_member_id, opened_at, resolved_at, sla_resolution_due_at, transformation_candidate, transformation_decision).
- `major_incident` (id, status, next_update_due_at).
- `case_survey` (score, submitted_at).

Enums verificados en comentario del codigo: `status ∈ new|triaged|assigned|in_progress|resolved|in_evolution`; `priority ∈ p1_critical|p2_high|p3_medium|p4_low`; `intake_status ∈ pending|accepted`.

**KPIs (Torre):**
- `slaCompliancePct`: sobre casos con `sla_resolution_due_at`, cumplidos = resueltos antes del due, o aun no vencidos. `round(met/withDue*100)`.
- `backlogOpen`: casos abiertos (excluye CLOSED = resolved/closed/cancelled e `in_evolution`).
- `unassignedPct`: sin asignar / abiertos.
- `mttrHours`: media de (resolved_at - opened_at) de resueltos ultimos 30d, en horas.
- `csat`: media de `case_survey.score` con `submitted_at` no nulo.

**Bandeja priorizada (decisions):** orden por `rank` (1 MI comm, 2 SLA vencido, 3 admitir aging>=1d, 4 asignar criticos sin asignar, 5 derivar candidatos no derivados). `intake` incluye `oldestDays`.

**`getOpsInbox(supabase)`:** `incident` (incident_number, title, status, priority, sla_resolution_due_at), estados OPEN + `in_evolution` + `resolved`, limit 200. Agrupa: `active` (abiertos), `evolution` (`in_evolution`, casos ancla), `observation` (`resolved`). Marca `overdue` si due < now y estado abierto.

**RPC del ex-dashboard/analitica:** `analytics_overview` (`sql/0048_analytics.sql`), `supervisor_metrics` (`sql/0067`), `dashboard_counts` (`sql/0073`/`0123`), `performance_metrics` (`sql/0054`), `recurrence_analytics` (`sql/0128`), `incident_behavior_analysis` (`sql/0093`). `getCategoryTrends` lee `incident (category, opened_at)` de los ultimos N dias (default 14) y arma sparklines por categoria.

**Ledger/auditoria:** la Torre es de solo lectura (no muta) -> no genera eventos de ledger propios. **RLS/tenant:** todas las lecturas via cliente del contexto (`getContext()`), scope por `tenant_id`; los RPC de analitica agregan con `current_tenant_id()` y gate `has_permission('analytics.read')`.

### 7. Flujos clave
1. **Atender la decision mas urgente:** el lider abre `/operaciones`, ve la rejilla "Requiere tu decision", clic en el CTA de mayor rank (p.ej. war-room de MI) -> navega al modulo con el filtro aplicado.
2. **Revisar salud operativa:** pestana Operacion -> funnel/workload/aging para detectar cuellos de botella y sobrecarga por agente.
3. **Analisis proactivo:** pestana Analitica -> Analytics (exec/supervisor/performance/recurrencia/reportes) + comportamiento por dimension, sin salir de la Torre.

---

## 2. `/sla-governance` — Gobierno SLA/OLA

**Archivo:** `app/(app)/sla-governance/page.tsx` · Componente: `components/sla/governance.tsx`
**Queries:** `lib/sla/queries.ts` · Thresholds: `lib/sla/thresholds.ts`

### 1. Ruta y parametros
Ruta `/sla-governance`, sin parametros de URL. Pestana interna en estado local (`risk|events|rules|ola`).

### 2. Modulo/categoria
Categoria macro **Operaciones**, item `nav.sla` (`perm: "sla.read"`). En `OPERATIONS_NAV` la Fase B lo fusiona con Catalogo en la pantalla "Catalogo y SLA" (`/service-catalog` con pestanas).

### 3. Proposito
Panel de gobierno de acuerdos de servicio: casos en riesgo de SLA, eventos de escalacion, reglas de escalacion (config) y politicas OLA por prioridad/equipo. Permite al lider vigilar semaforos e intervenir antes del incumplimiento.

### 4. Roles y permisos
- Ruta: `sla.read`. Gestion (crear/editar reglas, OLA, reconocer eventos): `sla.manage` -> `canManage = hasPermission(ctx.supabase, "sla.manage")`, pasado a los tabs.
- `support_agent` tiene `/sla-governance` denegado.

### 5. Pantalla
`Governance` con 4 pestanas + badges dinamicos:
- **Riesgo** (`RiskTab`, badge `risk.stats.atRisk`): incidentes en riesgo por bucket (warning/critical/breached).
- **Eventos** (`EventsTab`, badge `risk.stats.openEvents` = escalaciones sin reconocer): permite reconocer si `canManage`.
- **Reglas** (`RulesTab`): CRUD de reglas de escalacion, con `options` (roles/equipos reales).
- **OLA** (`OlaTab`): politicas OLA por prioridad/equipo.

### 6. Funcional/tecnico
- **`getAtRiskIncidents`:** `incident` (excluye resolved/closed/cancelled) con `ci:affected_ci_id(name)`, `service:affected_service_id(name)`. Calcula `clockView` de respuesta y resolucion (`lib/sla/thresholds.ts`), `overall = worstBucket(...)`, filtra `atRisk`, ordena por `bucketRank`. Ademas cuenta `escalation_event` con `acknowledged = false` (openEvents).
- **`listOlaPolicies`:** `ola_policy` (priority, assigned_team, response_minutes, resolution_minutes, status), excluye `deleted`.
- **`listEscalationRules`:** `escalation_rule` (code, name, sla_type, threshold_pct, priority, action, notify_role, action_target, status), excluye `deleted`.
- **`listEscalationEvents`:** `escalation_event` (+ join incident y rule), limit 50.
- **`getSlaFormOptions`:** roles reales (`role.code/name`) + equipos derivados de `incident_category.default_team` (catalogo real, no hardcode).
- **RLS/tenant:** todas las consultas via cliente del contexto; RLS aisla por tenant.

### 7. Flujos clave
1. **Vigilar riesgo:** pestana Riesgo -> ordenar por semaforo, abrir el caso critico.
2. **Reconocer escalaciones:** pestana Eventos -> reconocer (si `sla.manage`).
3. **Configurar politica:** pestanas Reglas/OLA -> alta/edicion con catalogos reales.

---

## 3. `/customers` — Clientes (lista)

**Archivo:** `app/(app)/customers/page.tsx` · Componente: `components/customers/customer-list.tsx`
**Queries:** `lib/customers/queries.ts`

### 1. Ruta y parametros
Ruta `/customers`, sin parametros. Filtros/agrupacion en estado cliente.

### 2. Modulo/categoria
Categoria macro **Operaciones**, item `nav.customers` (`perm: "incident.read"`).

### 3. Proposito
Directorio de clientes (personas) con su exposicion de casos: cuantos abiertos/totales, riesgo, segmento, VIP, ultima interaccion. Punto de entrada al Cliente 360.

### 4. Roles y permisos
- Ruta: `incident.read`.
- **Segregacion:** `/customers` esta en el `ROLE_ROUTE_DENY` de `support_lead` (Fase A/D elimina Clientes del rol) y de `support_agent`. Es decir, el Gerente de Operaciones y el Operador NO acceden por URL aunque tengan `incident.read`; es una vista de perfil multi-persona/admin/otros roles con acceso.

### 5. Pantalla
- `FilterBar` (segmento, riesgo) + `GroupBar` (agrupar por). Tabla con columnas: Cliente (nombre + `maskTaxId`), Segmento, Riesgo (pill por nivel), Abiertos, Total, Ultima interaccion. Fila -> `router.push("/customers/[id]")`. VIP con badge. Drill: clic en celda -> filtra.
- Estado vacio: `EmptyState` (`cust.empty`, icono user).

### 6. Funcional/tecnico
**`listCustomers`:** en paralelo `party` (party_type = `person`, status = `active`; id, display_name, segment, vip_flag, risk_level, tax_id, email) e `incident` (affected_party_id, status, opened_at). Cruza en memoria por `affected_party_id` para `openCases` (estados OPEN incl. `in_evolution`), `totalCases`, `lastInteraction`.
- **PII:** `maskTaxId` enmascara cedula (§3.1 #12). El email no se muestra en la lista.
- **RLS/tenant:** party e incident bajo RLS del contexto.

### 7. Flujos clave
1. **Buscar cliente y ver exposicion:** filtrar por riesgo/segmento, leer abiertos/totales.
2. **Abrir 360:** clic en fila -> `/customers/[id]`.

---

## 4. `/customers/[id]` — Cliente 360

**Archivo:** `app/(app)/customers/[id]/page.tsx` · Componente: `components/customers/customer-360.tsx`
**Queries:** `lib/customers/queries.ts` (`getCustomer360`)

### 1. Ruta y parametros
Ruta `/customers/[id]` (`params.id` = UUID de party). Si `getCustomer360(...).party` es nulo -> `notFound()`.

### 2. Modulo/categoria
Detalle bajo **Operaciones** / Clientes. Mismo candado de ruta (`/customers` -> `incident.read`, con denylist para support_lead/support_agent).

### 3. Proposito
Vista 360 del cliente: identidad enmascarada, alertas (VIP/alto riesgo/casos abiertos), historial de casos y productos afectados. Client-centric: la mesa nunca pierde el contexto del cliente.

### 4. Roles y permisos
Igual que `/customers` (prefijo `/customers` -> `incident.read`; denegado por persona a support_lead/support_agent).

### 5. Pantalla
- Header: avatar con iniciales, nombre, badge VIP, segmento + nivel de riesgo.
- **Alertas** (si aplica): VIP, alto riesgo (`high`/`critical`), N casos abiertos.
- Columna izquierda: **Casos** (lista, cada fila -> `/incidents/[id]`, con `StatusPill`, tipo y fecha). Vacio: `cust.nocases`.
- Columna derecha: **Identidad** (taxid/email/telefono enmascarados con `maskTaxId/maskEmail/maskPhone`) y **Productos** (chips derivados de los casos).

### 6. Funcional/tecnico
**`getCustomer360(id)`:** en paralelo `party` (por id, + legal_name, phone, status) e `incident` filtrado por `affected_party_id = id` con `product:affected_product_id(name)`, ordenado por opened_at desc. Deriva `products` (nombres distintos), `openCases`, `totalCases`.
- **PII:** enmascarado en toda la seccion de identidad.
- **RLS/tenant:** lecturas via contexto.

### 7. Flujos clave
1. **Contexto del cliente antes de atender:** abrir 360, leer alertas y casos abiertos.
2. **Saltar al caso:** clic en fila de Casos -> detalle del incidente.

---

## 5. `/fraud-disputes` — Fraude y Disputas

**Archivo:** `app/(app)/fraud-disputes/page.tsx` · Componente: `components/fraud/fraud-disputes.tsx` (+ `fraud-list.tsx`, `dispute-list.tsx`, `badges.tsx`)
**Queries:** `lib/fraud/queries.ts`

### 1. Ruta y parametros
Ruta `/fraud-disputes`, sin parametros. Pestana en estado cliente (`fraud|dispute`).

### 2. Modulo/categoria
Categoria macro **Operaciones**, item `nav.frauddisputes` (`perm: ["fraud.read", "dispute.read"]`, any-of). En `OPERATIONS_NAV` es el grupo **Disputas** (`op.disputas`, icono shield).

### 3. Proposito
Gestion de casos financieros anclados a incidentes: fraude (FR-) y disputas/contracargos (DP-). KPIs de exposicion/recuperado, filtros y drill, con PII de cliente siempre enmascarada.

### 4. Roles y permisos
- Ruta: any-of `fraud.read` / `dispute.read`.
- `support_agent` tiene `/fraud-disputes` denegado.

### 5. Pantalla
`FraudDisputes` con 2 pestanas:
- **Fraude** (`FraudList`): KPIs (Abiertos, Confirmados, Expuesto, Recuperado). Filtros: estado, tipo, fuente de deteccion. Agrupacion. Tabla: numero (FR-), caso (titulo + `incident_number` + cliente enmascarado), tipo, fuente, risk_score, expuesto (moneda), estado (`FraudStatusBadge`). Fila -> `/fraud-disputes/fraud/[id]`. Vacio: `fr.empty`.
- **Disputas** (`DisputeList`): KPIs (Abiertas, Vencidas, Disputado, Recuperado). Filtros: estado, tipo. Suma de monto disputado por estado (vista filtrada). Tabla: numero (DP-), caso, tipo, disputado, vencimiento (`DueChip` con dias restantes/overdue), estado. Fila -> `/fraud-disputes/dispute/[id]`. Vacio: `dp.empty`.

### 6. Funcional/tecnico
- **`listFraud`:** `fraud_case` (+ join `incident:incident_id(incident_number, title, customer_name)`), orden por reported_at desc. `incFields` enmascara `customer_name` con `maskName` y borra el join crudo. Stats: open (`reported|investigating|confirmed`), confirmed (`confirmed|recovered`), sumas expuesto/recuperado.
- **`listDisputes`:** `dispute_case` (+ join incident), orden por opened_at desc. Stats: open (`opened|investigating|awaiting_customer|submitted`), overdue (open + due < hoy), sumas disputado/recuperado.
- **Tablas/enums:** definidas en `sql/0059_fraud_dispute.sql`. Numeracion propia FR-/DP- via triggers `set_fraud_number`/`set_dispute_number` (`next_document_number`).
- **PII (§3.1 #12):** `maskName` deja iniciales visibles.
- **Ledger/auditoria:** `fraud_case` y `dispute_case` tienen trigger `audit_row_change()` on insert/update/delete (verificado en `sql/0059`). Toda mutacion queda auditada a nivel BD.
- **RLS/tenant:** `enable row level security` + policy `fraud_isolation` / `dispute_isolation` por `tenant_id` (verificado en `sql/0059`).

### 7. Flujos clave
1. **Triage de fraude:** filtrar por estado/fuente, abrir caso.
2. **Vigilar vencimientos de disputas:** pestana Disputas, `DueChip` rojo/ambar.

---

## 6. `/fraud-disputes/fraud/[id]` — Detalle de caso de fraude

**Archivo:** `app/(app)/fraud-disputes/fraud/[id]/page.tsx` · Componente: `components/fraud/fraud-detail.tsx`
**Queries:** `lib/fraud/queries.ts` (`getFraudCase`) · **Mutaciones:** `lib/fraud/actions.ts` · **Validacion:** `lib/fraud/validation.ts`

### 1. Ruta y parametros
`/fraud-disputes/fraud/[id]` (`params.id`). Si `getFraudCase` nulo -> `notFound()`. `canManage = hasPermission("fraud.manage")`.

### 2. Modulo/categoria
Detalle bajo **Operaciones** / Disputas. Ruta cubierta por prefijo `/fraud-disputes` (any-of `fraud.read`/`dispute.read`).

### 3. Proposito
Ficha del caso de fraude con su incidente ancla (la mesa nunca pierde el control), datos financieros y maquina de estados. Permite avanzar el estado y registrar recuperacion si el usuario tiene gestion.

### 4. Roles y permisos
- Lectura: `fraud.read`/`dispute.read` (prefijo). Gestion (avanzar estado, recuperacion): `fraud.manage` -> las acciones se muestran solo si `canManage`; el server action revalida el permiso (`guard("fraud.manage")`).

### 5. Pantalla
- Cabecera: numero FR-, `FraudStatusBadge`, tipo. Mensaje ok/err (`msg`).
- **Ancla** (si hay incidente): tarjeta enlazada a `/incidents/[id]` con borde acento (`fr.anchor`).
- Grid de campos: fuente, risk_score, expuesto, recuperado, cliente (enmascarado `maskName`), referencia de transaccion.
- **Bloque de gestion** (solo `canManage`): botones de transicion (`fraudNextStates(status)`) y, si estado `confirmed`/`recovered`, input de monto recuperado + guardar. Estado terminal: `fr.terminal`.

### 6. Funcional/tecnico
- **`getFraudCase`:** `fraud_case` `select *` + join incident (id, incident_number, title, status, priority, customer_name, transaction_reference).
- **`advanceFraudStatus(id, toStatus)`:** guard `fraud.manage`; valida transicion (`validateFraudTransition` -> maquina `FRAUD_TRANSITIONS`); patch `status` + timestamps (`confirmed_at`/`recovered_at`/`closed_at`) + `updated_by`. `revalidatePath`.
- **`recordFraudRecovery(id, amount)`:** guard; `validateRecovery(amount, amount_exposed)` (no negativo, no excede expuesto); update `amount_recovered`.
- **Maquina de estados** (`FRAUD_STATUSES`): reported -> investigating/false_positive; investigating -> confirmed/false_positive; confirmed -> recovered/closed; recovered/false_positive -> closed; closed terminal.
- **Validaciones:** `validateFraudOpen` (tipo/fuente en whitelist, risk 0-100, expuesto >= 0). Codigos de error via `ErrorCode` traducidos con `err.*`.
- **Ledger/auditoria:** trigger `audit_row_change()` on `fraud_case` (BD).
- **RLS/tenant:** cliente del contexto; `tenant_id` en insert/queries.

### 7. Flujos clave
1. **Investigar y confirmar:** avanzar reported -> investigating -> confirmed.
2. **Registrar recuperacion:** en confirmed/recovered, capturar monto (validado contra expuesto).
3. **Volver al caso ancla:** clic en la tarjeta ancla.

---

## 7. `/fraud-disputes/dispute/[id]` — Detalle de caso de disputa

**Archivo:** `app/(app)/fraud-disputes/dispute/[id]/page.tsx` · Componente: `components/fraud/dispute-detail.tsx`
**Queries:** `lib/fraud/queries.ts` (`getDisputeCase`) · **Mutaciones:** `lib/fraud/actions.ts`

### 1. Ruta y parametros
`/fraud-disputes/dispute/[id]` (`params.id`). Nulo -> `notFound()`. `canManage = hasPermission("dispute.manage")`.

### 2. Modulo/categoria
Detalle bajo **Operaciones** / Disputas.

### 3. Proposito
Ficha de disputa/contracargo con incidente ancla, procesador, monto disputado/recuperado, vencimiento, razon y maquina de estados.

### 4. Roles y permisos
Lectura por prefijo. Gestion: `dispute.manage` (acciones solo si `canManage`; server action revalida `guard("dispute.manage")`).

### 5. Pantalla
- Cabecera: numero DP-, `DisputeStatusBadge`, tipo. Mensaje ok/err.
- Ancla al incidente (`/incidents/[id]`).
- Grid: disputado, recuperado, vencimiento, razon (`reason_code`), procesador (`processor.name`), cliente (enmascarado), referencia de transaccion.
- Gestion (`canManage`): transiciones (`disputeNextStates`); si estado `won`/`submitted`, input de monto recuperado.

### 6. Funcional/tecnico
- **`getDisputeCase`:** `dispute_case` `select *` + join incident + `processor:processor_vendor_id(name)`.
- **`advanceDisputeStatus`:** guard `dispute.manage`; `validateDisputeTransition` (maquina `DISPUTE_TRANSITIONS`); patch status + `resolved_at` (won/lost) / `closed_at`.
- **`recordDisputeRecovery`:** `validateRecovery(amount, disputed_amount)`.
- **Maquina** (`DISPUTE_STATUSES`): opened -> investigating/cancelled; investigating -> awaiting_customer/submitted/cancelled; awaiting_customer -> submitted/cancelled; submitted -> won/lost; won/lost -> closed; cancelled/closed terminal.
- **Ledger:** trigger `audit_row_change()` on `dispute_case`.
- **RLS/tenant:** policy `dispute_isolation` por tenant.

### 7. Flujos clave
1. **Gestionar contracargo:** opened -> investigating -> submitted -> won/lost -> closed.
2. **Recuperacion en won/submitted:** registrar monto (validado contra disputado).

---

## 8. `/risk` — Riesgo operativo

**Archivo:** `app/(app)/risk/page.tsx` · Componente: `components/risk/risk-list.tsx`
**Queries:** `lib/risk/queries.ts` · **Mutaciones:** `lib/risk/actions.ts`

### 1. Ruta y parametros
Ruta `/risk`, sin parametros. Filtros en estado cliente. `canManage = hasPermission("risk.manage")`.

### 2. Modulo/categoria
Categoria macro **Operaciones**, item `nav.risk` (`perm: "risk.read"`).

### 3. Proposito
Registro de eventos de riesgo operativo (perdida estimada vs real, recuperado, plan de accion, vencimiento), con heatmap categoria x estado, tendencia mensual estimada/real y exportacion CSV. Convierte incidentes con impacto financiero en riesgos trazables.

### 4. Roles y permisos
- Ruta: `risk.read`. Gestion (ciclar estado): `risk.manage` -> boton de estado solo interactivo si `canManage`.
- **Segregacion:** `/risk` esta en `ROLE_ROUTE_DENY` de `support_lead` (eliminado del rol en Fase A/D) y de `support_agent`.

### 5. Pantalla
- Tarjetas KPI (responden a filtros): Abiertos, Estimado (+ Real como sub), Delta (real-estimado, rojo si >0), Vencidos, Mitigado %.
- **Heatmap** categoria x estado (intensidad por conteo, tooltip con estimado).
- **Tendencia** mensual (SVG): lineas estimado (teal) vs real (rojo).
- Filtros (categoria, estado, owner) + **Exportar CSV** (`exportCsv`, con metadatos: titulo, fecha de corte, filtros, filas; BOM UTF-8).
- Tabla completa: numero, categoria, descripcion (+ link al incidente ancla `◂ INC-`), estimado, real, vencimiento, estado (boton que **cicla** entre `open->assessing->mitigating->closed->accepted`), plan de accion. Vacio: `risk.empty`.

### 6. Funcional/tecnico
- **`listRiskEvents`:** `risk_event` (+ `incident:incident_id(id, incident_number)`, `owner:owner_user_id(full_name)`), orden por event_date desc. Stats: total, open (status != closed), estimatedTotal, actualTotal, recoveredTotal, delta, overdue (open + due < hoy), mitigatedPct (`mitigating|closed|accepted`).
- **`updateRiskStatus(id, status)`:** guard `risk.manage`; update `status`; `revalidatePath("/risk")`.
- **`createRiskEvent(incidentId)`** (usado desde el detalle de incidente): guard `risk.manage`; idempotente (si ya existe risk_event para el incidente, lo reutiliza); toma perdida estimada de `incident.amount ?? financial_impact_estimate`; inserta `risk_event` (risk_category = categoria del caso en minuscula o `operational`, owner = accountId, status `open`); **ademas inserta `incident_comment`** (`is_system_generated`, visibility internal) — deja rastro en el hilo del caso.
- **Ledger/auditoria:** `(no verificado)` — no se localizo el `create table risk_event` ni su trigger de `audit_row_change`/policy RLS en `sql/*` (solo referencias en `sql/0048_analytics.sql`, `sql/0055`, `sql/0136`; existe `set_risk_event_number`). Las queries siempre filtran/insertan con `tenant_id`, pero el DDL de RLS/audit de `risk_event` no aparece en las migraciones inspeccionadas (posible schema base squasheado).
- **RLS/tenant:** insert incluye `tenant_id` explicito; lecturas via contexto.

### 7. Flujos clave
1. **Vigilar exposicion:** leer KPIs + heatmap, filtrar por categoria/estado.
2. **Avanzar tratamiento:** ciclar estado del evento (si `risk.manage`).
3. **Exportar** para reporte GRC (CSV con metadatos).

---

## 9. `/analytics` — Analitica

**Archivo:** `app/(app)/analytics/page.tsx` · Componente: `components/analytics/analytics.tsx` (+ subcomponentes) · **Server action:** `app/(app)/analytics/actions.ts`
**Queries:** `lib/analytics/queries.ts`

### 1. Ruta y parametros
Ruta `/analytics`, sin parametros de URL. Pestana en estado cliente (`exec|supervisor|performance|recurrence|reports`).

### 2. Modulo/categoria
Categoria macro **Analitica** (`nav.analytics`, `perm: ["incident.read", "analytics.read"]`, any-of). En `EVOLUTION_NAV` aparece renombrada; en `OPERATIONS_NAV` se absorbe en la pestana Analitica de la Torre.

### 3. Proposito
Centro analitico ITSM: dashboard ejecutivo (salud del servicio, senales criticas, tendencia, satisfaccion, distribucion por prioridad, resumen por modulo), command center del supervisor, desempeno por area/servicio/persona/squad, reincidencia/efectividad de fixes, y exportacion de datasets.

### 4. Roles y permisos
- Ruta: any-of `incident.read`/`analytics.read`. Los RPC gatean por `analytics.read`; si el rol no lo tiene o algun RPC falla, `try/catch` -> `AnalyticsUnavailable` (no tumba el Server Component).
- `support_agent` tiene `/analytics` denegado.

### 5. Pantalla
`Analytics` con 5 pestanas:
- **Ejecutivo** (`ExecDashboard`): scorecard de salud (`serviceHealth`), 10 metricas (P1, SLA incumplido, MI, escalaciones sin ack, abiertos, MTTR, en evolucion, candidatos, CSAT, satisfaccion), grafico de area de tendencia + top categorias (con sparklines de `categoryTrends`), anillos CSAT y distribucion por prioridad, y tarjetas por modulo (problems/changes/risk/vendors/workflows/major-incidents).
- **Supervisor** (`SupervisorDashboard`): senales de control (6 KPIs), aging del backlog, cuellos de botella por estado, carga por agente, calidad de cierre.
- **Desempeno** (`PerformanceTab`): tablas por area, por servicio, por persona (CSAT/reabiertos), por squad.
- **Reincidencia** (`RecurrencePanel`): tasa de reincidencia, efectividad por operador (fixes que reaparecieron), reincidencia por categoria.
- **Reportes** (`ReportExport`): selector de dataset, busqueda + filtros por columna categorica (drill), descarga CSV.

### 6. Funcional/tecnico
- **RPC:** `getOverview` -> `analytics_overview`; `getPerformance` -> `performance_metrics`; `getSupervisor` -> `supervisor_metrics`; `getCategoryTrends` (lectura directa de `incident`); `getRecurrenceAnalytics` -> `recurrence_analytics` (ventana 90d por defecto).
- **Reportes:** `fetchReport(dataset)` (server action) exige permiso por dataset (`DATASET_PERM`: incidents->incident.read, changes->change.read, risk->risk.read, problems->problem.read); si falta -> `{ error: "PERMISSION" }`. `getReport` lee la tabla correspondiente (incident/change_request/risk_event/problem) limit 1000.
- **Ledger:** solo lectura -> sin eventos propios. La exportacion es cliente (Blob CSV).
- **RLS/tenant:** RPC con `current_tenant_id()` + gate de permiso; lecturas via contexto.

### 7. Flujos clave
1. **Lectura ejecutiva:** score de salud + senales criticas.
2. **Gestion del backlog:** pestana Supervisor.
3. **Exportar dataset filtrado:** pestana Reportes (con permiso por dataset).

---

## 10. `/analytics/comportamiento` — Analisis de comportamiento agregado

**Archivo:** `app/(app)/analytics/comportamiento/page.tsx` · Componente: `components/analytics/behavior-analysis.tsx`
**Queries:** `lib/analytics/queries.ts` (`getBehaviorAnalysis`, `normalizeDimension`)

### 1. Ruta y parametros
Ruta `/analytics/comportamiento`. `?dim=` (dimension) y `?weeks=` (ventana). `dim` normalizada a `BEHAVIOR_DIMENSIONS` (default `category`); `weeks` acotada `[4,52]` (default 12). Los cambios re-fetch en servidor (dato real, nada mockeado en cliente).

### 2. Modulo/categoria
Categoria macro **Analitica**, item `nav.behavior` (`perm: ["incident.read", "analytics.read"]`). Reutilizado embebido en la Torre (`basePath="/operaciones"`).

### 3. Proposito
Vista PROACTIVA del comportamiento AGREGADO de casos por dimension de negocio (categoria/producto/servicio/unidad/canal/proceso/prioridad): totales, abiertos, MTTR, SLA incumplido, candidatos de transformacion, momentum, impacto financiero, con tendencia semanal, proyeccion transparente y senales de causa-raiz. Nunca expone casos individuales (refuerza segregacion: product_owner no tiene incident.read).

### 4. Roles y permisos
- Ruta: any-of `incident.read`/`analytics.read`. El RPC `incident_behavior_analysis` gatea a nivel de datos por `analytics.read` (`raise exception 'forbidden'` con errcode 42501 si falta). Fallo -> `AnalyticsUnavailable`.

### 5. Pantalla
`BehaviorAnalysisView`:
- Cabecera + control de **Ventana** (4/8/12/26/52 semanas, gobierna la tendencia).
- KPIs: total, abiertos, grupos, proyeccion (con flecha up/down/flat), senales (danger si >0).
- **Banda de tendencia** (SVG con linea real + proyeccion punteada, micro-cards).
- Control **Agrupar por** (dimension, gobierna Ranking/Detalle/Senales).
- **Ranking:** tabla sortable (total con barra, abiertos, SLA, candidatos, momentum, impacto financiero).
- **Senales:** filas de alerta (causa-raiz candidata: `considerRC`).
- **Detalle por grupo:** tarjetas con orden funcional (selector de columna).
Estado vacio: `beh.empty` / `beh.signals.empty`.

### 6. Funcional/tecnico
- **`getBehaviorAnalysis(dimension, weeks)`** -> RPC `incident_behavior_analysis(p_dimension, p_weeks)` (`sql/0093`, SECURITY DEFINER, STABLE): gate `has_permission('analytics.read')`, scope `current_tenant_id()`, dimension por whitelist con CASE (no inyectable), etiquetas descriptivas por join a maestros (nombre, no UUID). Devuelve `{ dimension, window_weeks, total/open_incidents, groups[], trend[], projection, signals[] }`.
- **Interaccion sin perder posicion:** `router.push(..., { scroll:false })` preservando otros params (`?tab=` cuando esta embebido).
- **Ledger:** solo lectura. **RLS/tenant:** definer + gate + tenant scope.

### 7. Flujos clave
1. **Detectar concentracion de casos:** agrupar por producto/sistema, ordenar por total/momentum.
2. **Leer senal de causa-raiz:** revisar panel Senales (candidatos sin problema asociado).
3. **Proyeccion:** ajustar ventana y leer next_week.

---

## 11. `/casos-convertidos` — Casos convertidos

**Archivo:** `app/(app)/casos-convertidos/page.tsx` · Componente: `components/evolution/converted-cases.tsx`
**Queries:** `lib/evolution/queries.ts` (`getConvertedCases`)

### 1. Ruta y parametros
Ruta `/casos-convertidos`. `?ver=` (dimension de vista) y `?seg=` (segmento), normalizados a `DIM_KEYS` (`converted_to|status|priority|case_type|system|product|process|business_unit|channel|category`); defaults `converted_to` / `status`. La vista persiste en URL (`history.replaceState`) para compartir.

### 2. Modulo/categoria
Categoria macro **Evolucion**, item `nav.convertedcases` (`perm: ["project.read", "incident.read"]`, any-of). Aparece como "Casos en Evolucion" (read-only) tanto en `OPERATIONS_NAV` (unica ventana del Gerente de Operaciones a Evolucion) como en `EVOLUTION_NAV`.

### 3. Proposito
Trazabilidad incidencia -> candidato -> mejora -> proyecto (el "viaje de cada caso"), orientada al Gerente de Evolucion. Mantiene el hilo client-centric: la incidencia sobrevive como ancla (`in_evolution`) enlazada bidireccionalmente al proyecto.

### 4. Roles y permisos
- Ruta: any-of `project.read`/`incident.read`.
- El Gerente de Operaciones lo ve read-only; `squad_member` lo tiene denegado (`ROLE_ROUTE_DENY`).

### 5. Pantalla
`ConvertedCasesView`:
- Encabezado + mini-pipeline de conversion (4 etapas clicables: Total, Candidato, Mejora, Proyecto -> filtra por `converted_to`).
- Controles: presets + dos selectores (`Ver por` / `Segmentar por`).
- **Distribucion** (barras apiladas por dimension, colapsable).
- **Viaje de cada caso:** por grupo, tarjetas `JourneyCard` con `Stepper` de 4 pasos (caso/candidato/recomendacion/proyecto), chips de dimensiones, chip verde de proyecto (enlaza a `/projects/[id]` via `projectIds`), y ancla `in_evolution`.
- **Drawer** de detalle (`CaseDrawer`): stepper, campos (reporter, prioridad, fechas, score, partners, impacto financiero), dimensiones, y CTAs a `/incidents/[id]` y al proyecto.

### 6. Funcional/tecnico
- **`getConvertedCases`** -> RPC `converted_cases` (`sql/0098`, SECURITY DEFINER, gate `project.read`/`incident.read` + tenant): entrega solo los casos ya en el pipeline (el Gerente de Evolucion accede sin `incident.read` del universo).
- **Mapa codigo->id de proyecto:** la page consulta `project (id, project_code)` con `.in("project_code", codes)` para enlazar el chip verde sin tocar el RPC.
- **Ledger:** solo lectura. **RLS/tenant:** definer + gate + `tenant_id`.

### 7. Flujos clave
1. **Ver el embudo de conversion:** clic en etapa del mini-pipeline.
2. **Analizar por dimension:** presets o selectores Ver/Segmentar.
3. **Abrir el viaje de un caso:** tarjeta -> drawer -> saltar al caso o al proyecto.

---

## 12. `/cola-equipo` — Cola del equipo (Operador, solo lectura)

**Archivo:** `app/(app)/cola-equipo/page.tsx` · Componente: `components/operador/cola-equipo.tsx`
**Queries:** `lib/operador/queries.ts` (`getTeamQueue`)

### 1. Ruta y parametros
Ruta `/cola-equipo`, sin parametros. Toggle interno (`unassigned|others`).

### 2. Modulo/categoria
Persona **Operador** (`support_agent`, `SUPPORT_AGENT_NAV`), grupo Casos, item `nav.colaequipo` (`perm: "incident.read"`, `readOnly: true`). Ruta `/cola-equipo` -> `incident.read` en `ROUTE_PERMISSIONS`.

### 3. Proposito
Dar contexto/colaboracion al Operador: ver casos sin asignar y casos asignados a otros, en SOLO LECTURA. Nunca accion: sin botones, sin seleccion, sin "Tomar siguiente" (el Operador ejecuta solo sus casos asignados).

### 4. Roles y permisos
- Ruta: `incident.read`. Diseñada para `support_agent`; su nav marca `readOnly`. La regla de oro backend (`lib/auth/incident-authz`, mencionada en comentarios) refuerza que el Operador no gestione casos ajenos.

### 5. Pantalla
`OpQueueView`:
- Titulo + **banner permanente de solo lectura** (`op.queue.banner`, icono lock).
- Toggle: Sin asignar / Asignados a otros (con conteos).
- Donut por prioridad (visual).
- Tabla ligera SOLO LECTURA (cursor default, sin acciones): numero, titulo, prioridad (`PriorityTag`), estado (`StatusPill`), responsable (avatar + nombre, o `op.queue.nobody`), SLA (`SlaStatusInline`). Vacio: `op.queue.empty`.

### 6. Funcional/tecnico
- **`getTeamQueue(supabase, accountId)`:** obtiene `memberId` (`getMyMemberId`), lee `incident` (estados OPEN) con `assignee:assigned_member_id(name)`. Marca `_mine` (asignado al propio member/account) y separa: `unassigned` (sin `assigned_member_id`) y `others` (asignados y no propios; EXCLUYE los del propio operador). SLA via `clockView` (semaforo + tiempo humano, sin % crudo).
- **Ledger:** solo lectura. **RLS/tenant:** RLS aisla por tenant; la logica no expone datos accionables ajenos.

### 7. Flujos clave
1. **Ver que hay sin dueño:** pestana Sin asignar (contexto, no toma).
2. **Ver carga del equipo:** pestana Asignados a otros.

---

## Anexo: verificacion de RPC y tablas (evidencia)

- RPCs localizados en `sql/`: `analytics_overview` (0048), `performance_metrics` (0054), `supervisor_metrics` (0067), `dashboard_counts` (0073/0123), `incident_behavior_analysis` (0093), `converted_cases` (0098), `recurrence_analytics` (0128), `set_risk_event_number` (ref. 0136).
- `fraud_case`/`dispute_case`: DDL, RLS (`fraud_isolation`/`dispute_isolation` por tenant), triggers de numeracion y `audit_row_change` -> `sql/0059_fraud_dispute.sql` (verificado).
- `risk_event`: usado en queries/RPCs con `tenant_id`; su `create table` + RLS/audit trigger **no localizados** en `sql/*` inspeccionados -> `(no verificado)`.
- Guard de ruta y segregacion por persona: `lib/nav/access.ts` (`ROUTE_PERMISSIONS`, `ROLE_ROUTE_DENY`) + `app/(app)/layout.tsx` (verificado).


---

# Clúster C — Evolución + Proyectos

# CLUSTER C — Evolucion + Proyectos + Problemas/Cambios + Squads/Vendors/Observabilidad/Dependencias

Documentacion tecnica y de usuario basada EXCLUSIVAMENTE en el codigo real del repositorio Credix Nexus
(Next.js 16 App Router + Supabase). Todo lo no confirmado en codigo se marca "(no verificado)". Rutas citadas.
Salida en espanol. Nota de i18n al final de cada pantalla y en la seccion transversal.

> Nota de mecanismo transversal (§0 CLAUDE.md — "la mesa nunca pierde el control"): la cadena
> **incidencia -> evolucion -> proyecto** se materializa asi en el codigo:
> 1. En el detalle de un incidente, `components/incidents/detail/evolution-panel.tsx` + `derive-modal.tsx`
>    permiten "Derivar a Evolucion". Al confirmar se llama `sendToEvolution(incidentId)`
>    (`lib/incidents/actions.ts:462`), que **requiere `incident.assign` o `triage.manage`** (Gerencia de
>    Operaciones, NO el operador) y actualiza el incidente a `status = "in_evolution"`,
>    `transformation_candidate = true`, `transformation_decision = "to_evolution"`; inserta un
>    `incident_comment` visible al partner ("La mesa de ayuda mantiene el tracking y la comunicacion...")
>    y notifica al rol `product_owner` (RPC `notify_role`). **La incidencia queda como ANCLA (no se cierra).**
> 2. Del lado de Evolucion, una `project_recommendation` aprobada por el RC se convierte en `project`
>    mediante `convertRecommendation()` (`lib/projects/actions.ts:295`): crea el proyecto con
>    `source_type = "incident"`, `created_from_incident_id`, `created_from_recommendation_id`,
>    `created_from_rule_evaluation_id`, marca la recomendacion `converted` e inserta
>    `project_incident_link` (link_type `source`).
> 3. En `/projects/[id]`, `getAnchorCaseContext()` (`lib/projects/queries.ts:107`) proyecta en SOLO LECTURA
>    el incidente ancla y sus comentarios `visibility = "partner"` (hilo de comunicacion con el cliente),
>    para que Evolucion vea el contexto sin tener `incident.read` del universo.

---

## Indice de pantallas

1. `/evolucion` — Torre de Control del Gerente de Evolucion
2. `/evolucion/mapa` — Mapa de Tribus
3. `/projects` — Kanban / Bandeja de proyectos (iniciativas)
4. `/projects/[id]` — Detalle de iniciativa 360 (QA, ancla, squads, riesgos, WSJF)
5. `/projects/[id]/edit` — Editar proyecto
6. `/projects/new` — Nuevo proyecto
7. `/projects/portafolio` — Cockpit de Portafolio (WSJF, ROI, capacidad, roadmap)
8. `/casos-convertidos` — Trazabilidad incidencia -> candidato -> mejora -> proyecto
9. `/problems` — Listado de Problemas (ITIL Problem Mgmt)
10. `/problems/[id]` — Detalle de Problema (RCA, casos vinculados, ledger, cambios)
11. `/problems/[id]/edit` — Editar Problema
12. `/problems/new` — Nuevo Problema
13. `/changes` — Listado de Cambios (ITIL Change Mgmt)
14. `/changes/[id]` — Detalle de Cambio (CAB, planes, ledger, origen)
15. `/changes/[id]/edit` — Editar Cambio
16. `/changes/new` — Nuevo Cambio
17. `/squads` — Listado de Squads (tarjetas / tabla)
18. `/squads/[id]` — Squad 360 (roster, capacidad, backlog, liderazgo)
19. `/observability` — Centro de Observabilidad (Alertas + Experiencia digital)
20. `/dependencies` — Grafo de dependencias de servicios (blast radius)
21. `/vendors` — Listado / Scorecard de proveedores
22. `/vendors/[id]` — Detalle de proveedor (sistemas, incidentes)
23. `/vendors/[id]/edit` — Editar proveedor
24. `/vendors/new` — Nuevo proveedor

> Nota de navegacion (aplica a todo el cluster): las 24 rutas viven en la categoria macro **"Evolucion"**
> de `MACRO_NAV` (`lib/nav/navigation.ts:63-78`, icono `zap`), salvo `/casos-convertidos`. La persona
> **Gerente de Evolucion (`product_owner`)** recibe un reagrupamiento propio `EVOLUTION_NAV`
> (`lib/nav/navigation.ts:153-175`) con los mismos items (paths/perms intactos, solo se renombran labels):
> grupos *Evolucion / Estrategia / Ejecucion / Analisis 360 / Inteligencia / KM*. **`EVOLUTION_NAV` NO
> incluye `/observability` ni `/dependencies`** (esos solo aparecen en `MACRO_NAV` para admin o
> multi-persona). Ver seccion "Roles y permisos" de cada pantalla.

---

## 1. `/evolucion` — Torre de Control del Gerente de Evolucion

**1. Ruta y parametros.** `app/(app)/evolucion/page.tsx`. Sin parametros de ruta ni query.

**2. Modulo/categoria.** Macro "Evolucion" (`nav.evhome`, path `/evolucion`, perm `project.read`).
En `EVOLUTION_NAV` es el grupo `ev.evolucion` / item renombrado `nav.evx.control` ("Torre de Control").
Persona natural: `product_owner` (Gerente de Evolucion). Es el **home por defecto**? No: `defaultHome`
(`lib/nav/access.ts:127`) manda a `/projects` cuando el usuario tiene `project.read`/`squad.read` sin
`incident.read`; `/evolucion` es un destino de menu, no el landing.

**3. Proposito (manual).** Cockpit accionable del Gerente de Evolucion. Ordena la lectura en: (1) que
espera MI decision hoy (bandeja de decisiones), (2) el pipeline incidencia->entrega, (3) donde esta el
riesgo/valor (salud, capacidad por tribu, ROI), (4) tendencia. Todo es dato real agregado por RPC.

**4. Roles y permisos.** Ruta gateada por `project.read` (`ROUTE_PERMISSIONS` en `lib/nav/access.ts:46`).
Denegada por persona a `support_lead`, `squad_member`, `support_agent` (`ROLE_ROUTE_DENY` — aunque tengan
`project.read`). La bandeja de decisiones (`evolution_decisions`) esta **gateada por permiso por seccion
dentro del propio RPC** (comentario en `lib/evolution/queries.ts:42`). La tendencia (`getBehaviorAnalysis`)
se degrada silenciosamente si falla o falta permiso (`.catch` en `page.tsx:24`).

**5. Pantalla** (`components/evolution/evolution-home.tsx`):
- **Header**: saludo por hora + fecha larga (locale) + "linea de estado" calculada (n decisiones ·
  n tribus sobre-asignadas · n senales), o "todo despejado".
- **§1 Requiere tu decision**: contador grande + lista `DecisionRow`. Cada decision tiene `kind`
  (`mi_comm | cab | convert | signal | roi | kb`), severidad (`red`/`amber`), edad en dias, `link` y CTA.
- **§2 Pipeline** (`PIPELINE`): 6 etapas `candidates -> rec_pending -> rec_approved -> in_evolution ->
  proj_active -> proj_done`, cada una con valor (funnel) + aging, enlazadas a `/casos-convertidos`,
  `/projects`, `/projects/portafolio`.
- **§3 Riesgo y valor**: 3 modulos — `HealthModule` (bloqueados/en riesgo con items enlazados a
  `/projects/[id]`), `CapacityModule` (top 5 tribus con barra de carga, enlace a
  `/projects/portafolio?tribe=<id>`), `ValueModule` (ROI estimado vs real + "deuda de medicion").
- **§4 Tendencia**: sparkline SVG con proyeccion + enlace a `/analytics/comportamiento`.
- **§5 Accesos rapidos**: chips a portafolio, mapa de tribus, comportamiento, casos convertidos.

**6. Funcional/tecnico.**
- RPCs: `evolution_home` (`getEvolutionHome`) devuelve `{funnel, aging, health{blocked,at_risk,open_projects,items[]}, signals}`;
  `evolution_decisions` (`getEvolutionDecisions`) devuelve `DecisionItem[]` ordenado por `rank` y edad.
  Definidos en `sql/0102_evolution_home.sql` y `sql/0106_evolution_control_tower.sql`.
- Portafolio: `listPortfolio` (tabla `project`) -> `portfolioRoi` (`lib/projects/portfolio.ts`) para ROI.
- Capacidad: `getSquadCapacities` + `tribeCapacities` (FUENTE UNICA `lib/capacity`, mismos numeros que
  `/squads`, Squad 360, `/workload`).
- El estado `in_evolution` del funnel es donde se ven las **incidencias-ancla** aun en pipeline (etapa 4).
- Mutaciones: ninguna directa (pantalla de lectura/navegacion). Ledger: N/A aqui.
- RLS/tenant: los RPC son `SECURITY DEFINER` con gate de permiso + scope por `tenant_id`.

**7. Flujos clave.** Gerente entra -> ve decisiones pendientes -> clic en CTA lo lleva al war-room MI /
CAB / conversion / senal / ROI / KB segun `kind`. Desde el pipeline salta a los casos convertidos o al
portafolio. Desde salud entra a un proyecto bloqueado.

**i18n.** 100% via `useI18n`/`t(MessageKey)` (claves `tc.*`, `evh.funnel.*`, `nav.*`). Fecha con
`toLocaleDateString(es-ES/en-US)`. Sin textos quemados.

---

## 2. `/evolucion/mapa` — Mapa de Tribus

**1. Ruta y parametros.** `app/(app)/evolucion/mapa/page.tsx`. Sin parametros.

**2. Modulo/categoria.** Macro "Evolucion" (`nav.tribemap`, path `/evolucion/mapa`, perm **`squad.read`**).
En `EVOLUTION_NAV` esta en el grupo `ev.estrategia`. `ROUTE_PERMISSIONS` mapea el prefijo mas especifico
`/evolucion/mapa -> squad.read` (mas largo que `/evolucion -> project.read`).

**3. Proposito.** Vista de alto nivel Tribu x Squad (Fase 1) con gestion inline cuando el usuario tiene
`squad.manage`. Es la "Torre/Mapa" de la estructura de entrega.

**4. Roles y permisos.** Ruta gateada por `squad.read`. `hasPermission("squad.manage")` decide si el
componente `TribeMap` habilita edicion inline (`canManage`). `squad.read` lo tienen: support_agent,
support_lead, people_lead, change_manager, product_owner, auditor, ai_agent, system_admin, tenant_admin
(seed RBAC). Denegado por persona a support_lead/squad_member/support_agent (`ROLE_ROUTE_DENY` incluye
`/evolucion`).

**5. Pantalla.** Renderiza `components/tribes/tribe-map.tsx` (fuera del alcance de lectura de este cluster —
**(no verificado el detalle interno del componente)**) con props `tribes`, `squads`, `canManage`.

**6. Funcional/tecnico.** Datos: `listTribes` + `listSquadsLite` (`lib/tribes/queries.ts`, fuera de este
cluster) + `hasPermission("squad.manage")`. Tablas base `tribe` / `squad` (`sql/0099_tribe_and_squad_domain.sql`).
RLS por tenant.

**7. Flujos clave.** Consultar la composicion tribu/squad; con `squad.manage`, reasignar squads a tribus
inline (no verificado el detalle de la mutacion, vive en `components/tribes`).

**i18n.** Etiquetas `nav.tribemap` y las del componente `tribe-map` (no verificado el set exacto).

---

## 3. `/projects` — Kanban / Bandeja de proyectos (iniciativas)

**1. Ruta y parametros.** `app/(app)/projects/page.tsx`. Sin parametros; el modo de vista (kanban/inbox)
y el orden (WSJF/ROI) son estado de cliente.

**2. Modulo/categoria.** Macro "Evolucion" (`nav.projects`, path `/projects`, perm `project.read`).
En `EVOLUTION_NAV`, grupo `ev.estrategia`.

**3. Proposito.** Tablero de trabajo de las iniciativas de Evolucion. Prioriza por WSJF o ROI, permite
convertir recomendaciones aprobadas en proyectos, y ofrece una "Bandeja por accion" (grupos por
origen/estado) ademas del Kanban de 3 columnas.

**4. Roles y permisos.** Ruta gateada por `project.read`. Persona `product_owner` (project.read+manage).
Denegada a support_lead/squad_member/support_agent. Acciones de conversion/QA re-validan permiso en el
servidor.

**5. Pantalla** (`components/projects/kanban.tsx`):
- **Hero** con titulo + subtitulo + `PortfolioLink` + `NewProjectButton` (link a `/projects/new`).
- **`ConvertStrip`** (si hay `convertibles`): recomendaciones `approved` sin proyecto; selector de squad +
  boton "Convertir" -> `convertRecommendation`.
- **`FilterBar`**: filtros por squad y unidad de negocio (`useListFilters`).
- **Toggle vista** kanban/inbox + **orden** WSJF/ROI (solo kanban).
- **Kanban** 3 columnas: `proposed` (proposed/approved/on_hold), `active`, `closed` (completed/cancelled).
  `ProjectCard`: nombre, WSJF, chip ROI, code, squad (drill), y `◂ INC-####` si nace de incidente (ancla).
- **Bandeja (`CaseInbox`)**: grupos `converted` (con incidente, en analisis), `analysis` (sin incidente),
  `active`, `blocked` (on_hold), `approval` (qa_status=in_testing -> boton **Aprobar** = `setQaStatus(passed)`),
  `release` (qa_status=passed y no autorizado -> boton **Autorizar** = `authorizeProduction`). "Devolver"
  siempre enruta al detalle (exige motivo).

**6. Funcional/tecnico.**
- Datos: `listProjects` (tabla `project`, orden WSJF desc, incluye `qa_status`, `prod_authorized_at`,
  join squad/incident/business_unit), `getConvertibleRecommendations` (`project_recommendation` approved
  sin `created_project_id`), `getProjectOptions` (squads activos).
- Mutaciones (server actions): `convertRecommendation` (`lib/projects/actions.ts:295`),
  `setQaStatus`/`authorizeProduction` (`lib/projects/qa-actions.ts`, guard `project.validate`/`project.deploy`).
- ROI cliente: `computeRoi(benefit, cost)`. WSJF viene calculado en BD (columna `wsjf`).
- **Ancla**: los proyectos con `incident` (via `created_from_incident_id`) muestran el numero de caso;
  el grupo "converted" de la bandeja los separa. Enlace bidireccional caso<->proyecto.
- Ledger/RLS: tabla `project` con trigger `audit_row_change()` + RLS `project_isolation` por
  `current_tenant_id()` (`sql/0025_projects.sql`).

**7. Flujos clave.**
1) Convertir recomendacion -> se crea proyecto `active` ligado al incidente (`project_incident_link`).
2) Priorizar por WSJF/ROI (drag no; es reordenamiento por sort).
3) Aprobacion Lider/PO desde la bandeja: `in_testing -> passed`, luego `passed -> autorizado a produccion`.

**i18n.** Claves `proj.*`, `nav.projects`. Moneda/numeros locale-aware en detalle. Sin hardcode.

---

## 4. `/projects/[id]` — Detalle de iniciativa 360

**1. Ruta y parametros.** `app/(app)/projects/[id]/page.tsx`. Param `id` (uuid del proyecto).

**2. Modulo/categoria.** Macro "Evolucion" (bajo `nav.projects`). Persona `product_owner`.

**3. Proposito.** Vista 360 de una iniciativa: gestion de calidad (QA + pase a produccion), tareas,
caso de negocio IA, riesgos/blockers/dependencias, squads involucrados, WSJF desglosado, financieros, y
—cuando nace de un incidente— el **panel de origen (ancla)** con el hilo de comunicacion con el cliente.

**4. Roles y permisos.** Ruta `project.read`. Permisos resueltos con `getAccessControl` (cache por request):
`can("project.validate")`, `can("project.deploy")`, `can("workflow.run")`, `can("talent.manage")`,
`can("project.manage")`, `can("incident.read")`. La UI habilita botones segun cada permiso; el deep-link al
caso ancla solo aparece con `incident.read`.

**5. Pantalla** (`components/projects/project-detail.tsx`):
- **Cabecera**: code + nombre + `ProjectStepper` (proposed->active->completed, o cancelled) + chip de
  tipo de iniciativa + chip de salud (`initiativeHealth(risks)` + nro de riesgos abiertos). Si `canManage`:
  botones Activar / Completar / Editar / Cancelar (soft-delete a `cancelled`).
- **`QaPanel`**: stepper de calidad (Pendiente->En pruebas->Aprobado->Autorizado), pipeline de workflow
  (iniciar definicion via `startWorkflow`), transiciones `QA_NEXT`, bateria de pruebas
  (`recordValidation`), autorizacion a produccion (`authorizeProduction`).
- **Columna izq**: descripcion; **Tareas** (agregar/ciclar estado todo->doing->blocked->done);
  **Caso de negocio IA** (`AiBusinessCase`: genera con IA, editable, guarda en `project.business_case`);
  **`InitiativeRisks`** (blockers/riesgos/dependencias, con squad relacionado para dependency);
  **Origen (ancla)**: numero+titulo del incidente, estado (StatusPill), y si hay `anchor`, fechas y el
  **hilo de comentarios visibles al partner** (SOLO LECTURA).
- **Columna der**: panel `EvaluateMemberPanel` (si completado + talent.manage); tarjeta **WSJF**
  `(bv+tc+rr)/js`; **`InitiativeSquads`** (lead + contribuyentes, allocation %); ficha squad/area/BU;
  financieros (beneficio/costo/ROI estimado).

**6. Funcional/tecnico.**
- Datos (`page.tsx`): `getProject`, `getProjectTasks`, `getProjectValidations`, `getWorkflowsForProject`,
  `getActiveDefinitions("project")`, `getSquadRoster`, `getAnchorCaseContext`, `getProjectSquads`,
  `getProjectOptions`, `getProjectRisks`.
- **Ancla** (`getAnchorCaseContext`, `lib/projects/queries.ts:107`): lee `incident` + `incident_comment`
  con `visibility = "partner"` (limite 30). Es la implementacion de "la mesa conserva el hilo".
- Mutaciones: `addProjectTask`, `setTaskStatus`, `changeProjectStatus`, `softDeleteProject`,
  `saveBusinessCase`, y las de squads/riesgos (`addProjectSquad`, `setInitiativeLead`,
  `updateProjectSquadAllocation`, `removeProjectSquad`, `addProjectRisk`, `setProjectRiskStatus`,
  `removeProjectRisk`), y QA (`setQaStatus`, `recordValidation`, `authorizeProduction`).
- **Cierre de conocimiento**: `changeProjectStatus("completed")` invoca `captureClosureKnowledge`
  (draft de KB) y notifica a `support_lead` + `responsable_comercial` (RPC `notify_role`) que se cierra el
  hilo — refuerzo del principio §0 (la mesa recupera el control al completar la evolucion).
- **WSJF**: `business_value + time_criticality + risk_reduction` / `job_size` (columna `wsjf` en BD).
  `scoring` de transformacion vive en el incidente/regla (no en esta pantalla).
- Ledger/RLS: `project`, `project_task`, `project_incident_link`, `project_squad`, `project_risk`,
  `project_validation` con triggers `audit_row_change()` + RLS por tenant
  (`sql/0025_projects.sql`, `0053_project_qa.sql`, `0100_project_squad.sql`, `0101_project_risk.sql`).

**7. Flujos clave.**
1) QA dual-control: `project.validate` aprueba pruebas (`passed`), `project.deploy` autoriza produccion.
2) Gestion de riesgos/blockers; una dependency puede apuntar a otro squad.
3) Completar la iniciativa -> KB draft + notificacion a la mesa (cierra el ciclo del ancla).

**i18n.** Claves `proj.*`, `qa.*`, `irisk.*`, `initsq.*`, `init.type.*`. Moneda `CRC` (`es-CR`/`en-US`).

---

## 5. `/projects/[id]/edit` — Editar proyecto

**1. Ruta y parametros.** `app/(app)/projects/[id]/edit/page.tsx`. Param `id`.

**2. Modulo/categoria.** Macro "Evolucion". Persona `product_owner`.

**3. Proposito.** Formulario de edicion de un proyecto: nombre, descripcion, squad, BU, financieros
estimados y **reales (actuals)**, y los 4 componentes WSJF.

**4. Roles y permisos.** Ruta `project.read`. **Observacion (finding):** la pagina `edit` **no** aplica un
`redirect` por permiso; carga el proyecto y renderiza el form. `updateProject` server action **solo valida
`ctx.tenantId`** (no re-chequea `project.manage`) — depende de RLS + gating de UI. Ver hallazgos transversales.

**5. Pantalla** (`components/projects/project-form.tsx`, mode="edit"): tarjetas Nombre/descripcion +
squad/BU/beneficio/costo; tarjeta WSJF (4 inputs, muestra WSJF calculado en vivo); tarjeta **Actuals**
(beneficio/costo real, con ROI real vs estimado). Botones Cancelar / Guardar.

**6. Funcional/tecnico.** Carga: `getProject` + `getProjectOptions`. Mutacion `updateProject`
(`lib/projects/actions.ts:92`). Validacion (`validate` en actions): `minLength(name,5)`, montos no
negativos, actuals opcionales pero no negativos si vienen, `jobSize >= 1`. `wsjfCols`/`actualCols`
normalizan. `actual_*` null explicito si no se informa (distingue "no medido" de "0").

**7. Flujos clave.** Editar estimados y luego registrar reales para calcular ROI real (alimenta el ROI
del portafolio y la "deuda de medicion" de la Torre).

**i18n.** Claves `proj.field.*`, `proj.actuals.*`, `proj.roi.*`, errores via `useErrorMessage`.

---

## 6. `/projects/new` — Nuevo proyecto

**1. Ruta y parametros.** `app/(app)/projects/new/page.tsx`. Sin parametros. Quick action del Command
Menu (`QUICK_ACTIONS` `qa.newProject`, perm `project.manage`).

**2. Modulo/categoria.** Macro "Evolucion". Persona `product_owner`.

**3. Proposito.** Alta manual de una iniciativa (fuera del flujo de conversion desde incidente).

**4. Roles y permisos.** Ruta `project.read`. **Finding:** la pagina no hace `redirect` por permiso y
`createProject` **solo valida `ctx.tenantId`** (no `project.manage`); el Command Menu si gatea el atajo con
`project.manage`, pero la ruta directa no. Depende de RLS.

**5. Pantalla.** `ProjectForm` mode="create" (sin tarjeta Actuals). Defaults: `projectType="evolution"`,
WSJF components = 5, jobSize = 5.

**6. Funcional/tecnico.** `createProject` inserta con `status="proposed"`, `source_type="manual"`,
`project_type = input || "evolution"`. Codigo `project_code` lo asigna el trigger `trg_project_number`
(BD). Validacion `minLength(name,5)` + montos.

**7. Flujos clave.** Crear -> redirige a `/projects/[id]` del nuevo proyecto.

**i18n.** Igual que §5 (mode create).

---

## 7. `/projects/portafolio` — Cockpit de Portafolio

**1. Ruta y parametros.** `app/(app)/projects/portafolio/page.tsx`. Query **`?tribe=<id>`** (filtro por tribu).

**2. Modulo/categoria.** Macro "Evolucion" (`nav.portfolio`, path `/projects/portafolio`, perm `project.read`).
En `EVOLUTION_NAV` grupo `ev.estrategia`.

**3. Proposito.** Cockpit estrategico: WSJF desglosado, ROI estimado vs real, capacidad prospectiva por
Tribu -> Squad -> Proyecto (drill-down), y roadmap tipo Gantt-lite.

**4. Roles y permisos.** Ruta `project.read`. Persona `product_owner`. Denegado a
support_lead/squad_member/support_agent.

**5. Pantalla** (`components/projects/portfolio.tsx`):
- Hero + chips de **filtro por tribu** (Todas + una por tribu con squads).
- **KPIs**: proyectos, activos, beneficio (compacto CRC), ROI estimado, ROI real (con `medido/total`).
- **WSJF desglosado**: barra segmentada bv/tc/rr por proyecto (top 12) + tamano + WSJF.
- **Capacidad**: roll-up por tribu (`TribeHeader`) y por squad (`CapacityRow`) con barra demanda/capacidad
  y **drill-down** a la lista de proyectos abiertos que atiende cada squad. "Sin tribu" separado.
- **ROI estimado vs real**: tabla (solo proyectos con actuals) con delta.
- **Roadmap**: barras planificadas + linea de ejecucion real sobre eje de meses.

**6. Funcional/tecnico.** Datos: `listPortfolio` (tabla `project`, todos los campos WSJF/actuals/fechas) +
`getSquadCapacities`. Capacidad de la **FUENTE UNICA** `lib/capacity` (`tribeCapacities`,
`SquadCapacity`); el filtro por tribu solo cambia QUE se muestra, no recalcula la carga real. ROI via
`portfolioRoi`/`computeRoi`. RLS por tenant en `project`/`squad`.

**7. Flujos clave.** Filtrar por tribu -> ver carga y backlog -> entrar a un proyecto; comparar ROI real
vs estimado para priorizar.

**i18n.** Claves `port.*`, `proj.wsjf.*`, `pst.*`. Moneda compacta `CRC`, meses locale.

---

## 8. `/casos-convertidos` — Trazabilidad incidencia -> mejora -> proyecto

**1. Ruta y parametros.** `app/(app)/casos-convertidos/page.tsx`. Query **`?ver=<dim>&seg=<dim>`**
(dimensiones de la vista; validadas contra `DIM_KEYS`, default `converted_to`/`status`).

**2. Modulo/categoria.** Macro "Evolucion" (`nav.convertedcases`, path `/casos-convertidos`,
perm **`["project.read","incident.read"]`** any-of). En `EVOLUTION_NAV` grupo `ev.analisis360`.
En `OPERATIONS_NAV` aparece tambien como "Casos en Evolucion" (RO) — es la UNICA ventana de la Gerencia de
Operaciones hacia Evolucion.

**3. Proposito.** Trazabilidad completa del "viaje de cada caso": incidencia -> candidato -> mejora ->
proyecto. Pipeline de conversion + distribucion por dimension + tarjetas por caso con stepper + drawer de
detalle. Orientada al Gerente de Evolucion sin necesidad de `incident.read` del universo.

**4. Roles y permisos.** Ruta any-of `project.read` OR `incident.read`. El RPC `converted_cases` es
`SECURITY DEFINER` con gate `project.read`/`incident.read` + scope tenant (solo casos ya en el pipeline,
no el universo de incidentes). Denegado por persona a squad_member/support_agent; support_lead lo ve
(no esta bloqueado, es su ventana RO).

**5. Pantalla** (`components/evolution/converted-cases.tsx`):
- Encabezado compacto + **mini-pipeline** (Total / Candidato / Mejora / Proyecto) clickable (filtra por
  etapa `converted_to`).
- **Controles**: presets + dos selectores "Ver por" / "Segmentar por" (10 dimensiones: converted_to,
  status, priority, case_type, system, product, process, business_unit, channel, category). Persisten en URL.
- **Distribucion** (colapsable): barras apiladas por dimension.
- **Viaje de cada caso**: `JourneyCard` con numero de incidente (link a `/incidents/[id]`), `Stepper`
  4 pasos (caso->candidato->recomendacion->proyecto), chip verde con `project_code` (link a
  `/projects/[id]`), chips de dimensiones y **chip `in_evolution`** cuando el caso sigue anclado.
- **Drawer** `CaseDrawer`: score de transformacion, partners, impacto financiero, dimensiones, links a
  caso y proyecto.

**6. Funcional/tecnico.** Datos: `getConvertedCases` (RPC `converted_cases`, tipo `ConvertedCase` con
`transformation_score`, `transformation_decision`, `financial_impact`, `converted_to`,
`project_code/name/status`, `recommendation_status`). La pagina resuelve `project_code -> id` con un query
extra a `project` para enlazar el chip verde sin tocar el RPC. `sql/0098_converted_cases.sql`.
- **Ancla en UI**: `c.status === "in_evolution"` pinta el chip destacado (`converted-cases.tsx:301`).
- Sin mutaciones (pantalla analitica). Ledger N/A. RLS via el RPC definer + tenant.

**7. Flujos clave.** Auditar de punta a punta como una incidencia se volvio proyecto; medir cuantos casos
pasan cada etapa; abrir el caso o el proyecto desde el mismo lugar.

**i18n.** Claves `cc.*`. Moneda `CRC`, fechas `es-CR`/`en-US`.

---

## 9. `/problems` — Listado de Problemas

**1. Ruta y parametros.** `app/(app)/problems/page.tsx`. Sin parametros.

**2. Modulo/categoria.** Macro "Evolucion" (`nav.problems`, path `/problems`, perm `problem.read`). En
`EVOLUTION_NAV` grupo `ev.analisis360` con `readOnly:true` y label `nav.evx.problems` (Evolucion lo ve en
SOLO LECTURA).

**3. Proposito.** Gestion de Problemas ITIL 4: registro de problemas (causa raiz de incidentes recurrentes),
errores conocidos, y su relacion con incidentes.

**4. Roles y permisos.** Ruta `problem.read` (roles: support_agent, support_lead, auditor, ai_agent,
system_admin, tenant_admin, y **`product_owner`** por migracion posterior). Boton "Nuevo" y gestion:
`problem.manage` (support_lead, system_admin — el RC/product_owner NO gestiona; `product_owner` fue
revocado de `problem.manage` en `sql/0091`). `canManage = hasPermission("problem.manage")`.

**5. Pantalla** (`components/problems/problem-list.tsx`): intro + boton "Nuevo" (si canManage) + **KPIs**
(abiertos, errores conocidos, resueltos, incidentes vinculados) + `FilterBar`/`GroupBar` (status, priority,
category, owner) + tabla (numero, titulo con badge "error conocido", categoria, prioridad, # vinculados,
estado). Filas enlazan a `/problems/[id]`. Filtros drill inline.

**6. Funcional/tecnico.** `listProblems` (tabla `problem`, con conteo `problem_incident`). Stats derivadas
de `OPEN_STATES = [new, investigating, known_error]`. RLS `problem_isolation` por tenant + trigger
`audit_row_change()` (`sql/0042_problem_management.sql`).

**7. Flujos clave.** Filtrar por estado/prioridad; abrir un problema; crear uno nuevo (con permiso).

**i18n.** Claves `prob.*`, `flt.*`.

---

## 10. `/problems/[id]` — Detalle de Problema

**1. Ruta y parametros.** `app/(app)/problems/[id]/page.tsx`. Param `id`.

**2. Modulo/categoria.** Macro "Evolucion" (`nav.problems`).

**3. Proposito.** Ficha del problema: descripcion, **causa raiz (RCA)**, workaround, incidentes vinculados
(vincular/desvincular), ledger inmutable, y cambios relacionados.

**4. Roles y permisos.** Ruta `problem.read`. `canManage = problem.manage` (transiciones de estado, vincular
incidentes, editar). `canManageChange = change.manage` (crear cambio desde el problema).

**5. Pantalla** (`components/problems/problem-detail.tsx`):
- Cabecera: numero + titulo + `ProblemStatusBadge` + prioridad + badge "error conocido". Botones de
  transicion (`PROBLEM_NEXT`) + Editar (si canManage).
- Col izq: descripcion; **RCA**; **Workaround**; **Casos vinculados** (selector `linkable` + agregar/
  quitar); **Ledger** (block_height, action, hash, timestamp).
- Col der: detalle (owner, categoria, servicio, CI, fechas opened/resolved/closed); **Cambios del problema**
  (`ChangeLink`, con `newHref=/changes/new?problem=<id>`).

**6. Funcional/tecnico.** Datos: `getProblem`, `getLinkedIncidents`, `getLinkableIncidents`,
`getLedgerForEntity` (ledger via `lib/incidents/queries`), `getChangesForProblem`, `getAccessControl`.
Mutaciones: `changeProblemStatus` (valida `PROBLEM_STATUSES`, sella `resolved_at`/`closed_at`),
`linkIncidentToProblem`/`unlinkIncidentFromProblem` (inserta `problem_incident` + comentario interno en el
incidente "La mesa mantiene el tracking"; duplicado -> `ErrorCode.DUPLICATE`). Existe tambien
`createProblemFromIncident` (`lib/problems/actions.ts:109`) invocada desde el detalle del caso.
Estado inicial: `known_error ? "known_error" : "new"`. Validacion (`validateProblem`): titulo>=5, prioridad
valida, y **error conocido exige causa raiz** (espeja CHECK de BD). Ledger real: tabla `problem` +
`problem_incident` con `audit_row_change()`.

**7. Flujos clave.** Promover incidente a problema -> vincular mas incidentes -> documentar RCA/workaround ->
marcar error conocido -> abrir un cambio para remediar -> resolver/cerrar.

**i18n.** Claves `prob.*`, `chg.section.problem`, `inc.section.ledger`.

---

## 11. `/problems/[id]/edit` — Editar Problema

**1. Ruta y parametros.** `app/(app)/problems/[id]/edit/page.tsx`. Param `id`.

**2. Modulo/categoria.** Macro "Evolucion".

**3. Proposito.** Editar los campos del problema (incl. RCA, workaround, servicio/CI afectado, error conocido).

**4. Roles y permisos.** **Guard duro**: `if (!hasPermission("problem.manage")) redirect(/problems/[id])`.
`updateProblem` re-valida el permiso en el servidor (`guard()`).

**5. Pantalla.** `ProblemForm` (`components/problems/problem-form.tsx`) con `initial` derivado del problema.
Opciones de catalogo reales via `getProblemFormOptions` (servicios activos, apps=CI type application,
categorias de `incident_category`).

**6. Funcional/tecnico.** `updateProblem` (guard `problem.manage`, `validateProblem`). Campos normalizados
con `orNull`. RLS + ledger como §10.

**7. Flujos clave.** Corregir/ampliar la ficha; activar error conocido (exige RCA).

**i18n.** Claves `prob.field.*`.

---

## 12. `/problems/new` — Nuevo Problema

**1. Ruta y parametros.** `app/(app)/problems/new/page.tsx`. Sin parametros. Quick action `qa.newProblem`
(perm `problem.manage`).

**2. Modulo/categoria.** Macro "Evolucion".

**3. Proposito.** Alta manual de un problema.

**4. Roles y permisos.** **Guard duro**: `if (!problem.manage) redirect(/problems)`. `createProblem`
re-valida `problem.manage`.

**5. Pantalla.** `ProblemForm` sin `initial` + `getProblemFormOptions`.

**6. Funcional/tecnico.** `createProblem` inserta con `owner_user_id = ctx.accountId`, estado inicial segun
`known_error`, numeracion `problem_number` por trigger BD. Validacion `validateProblem`.

**7. Flujos clave.** Crear -> redirige a `/problems` (revalida). (No redirige al detalle: `createProblem`
retorna id pero el form navega segun su logica — no verificado el destino exacto del form.)

**i18n.** Claves `prob.*`.

---

## 13. `/changes` — Listado de Cambios

**1. Ruta y parametros.** `app/(app)/changes/page.tsx`. Sin parametros.

**2. Modulo/categoria.** Macro "Evolucion" (`nav.changes`, path `/changes`, perm `change.read`). En
`EVOLUTION_NAV` grupo `ev.analisis360` con `readOnly:true`, label `nav.evx.changes`.

**3. Proposito.** Gestion de Cambios ITIL: RFCs con tipo (standard/normal/emergency), riesgo, y flujo CAB.

**4. Roles y permisos.** Ruta `change.read` (roles: support_agent, support_lead, auditor, ai_agent,
system_admin, tenant_admin, change_manager, product_owner). `canManage = change.manage`
(support_lead, change_manager, system_admin, tenant_admin). Decision CAB: `change.approve`
(change_manager, system_admin, tenant_admin).

**5. Pantalla** (`components/changes/change-list.tsx`): intro + boton "Nuevo" (si canManage) +
`FilterBar`/`GroupBar` (type, risk, status, assignee) + **KPIs** (abiertos, pendientes CAB, programados,
emergencia) + tabla (numero, titulo, tipo, riesgo, origen incidente/problema, estado). Filas a `/changes/[id]`.

**6. Funcional/tecnico.** `listChanges` (tabla `change_request`). `OPEN` states para stats. RLS
`change_isolation` + `audit_row_change()` (`sql/0045_change_management.sql`).

**7. Flujos clave.** Filtrar por estado/riesgo; abrir un cambio; crear nuevo (con permiso).

**i18n.** Claves `chg.*`.

---

## 14. `/changes/[id]` — Detalle de Cambio

**1. Ruta y parametros.** `app/(app)/changes/[id]/page.tsx`. Param `id`.

**2. Modulo/categoria.** Macro "Evolucion".

**3. Proposito.** Ficha del cambio con maquina de estados, panel de decision CAB, planes de implementacion/
rollback, origen (incidente/problema), resultado CAB y ledger.

**4. Roles y permisos.** Ruta `change.read`. `canManage = change.manage` (transiciones + editar).
`canApprove = change.approve` (panel CAB aprobar/rechazar, solo visible en `pending_cab`).

**5. Pantalla** (`components/changes/change-detail.tsx`):
- Cabecera: numero + titulo + `ChangeStatusBadge` + `RiskBadge` + tipo. Botones de transicion `CHANGE_NEXT`
  + Editar (si canManage).
- **Panel CAB** (si `pending_cab` y canApprove): textarea de notas + Aprobar/Rechazar (`cabDecision`).
- Col izq: descripcion, justificacion, plan de implementacion, plan de rollback, **Ledger**.
- Col der: detalle (requester, assignee, servicio, CI, fechas planificadas/reales); **Origen** (links a
  `/incidents/[id]` y `/problems/[id]`); **Resultado CAB** (decision, fecha, notas).

**6. Funcional/tecnico.** Datos: `getChange` (joins ci/service/incident/problem/requester/assignee/workflow)
+ `getLedgerForEntity` + `getAccessControl`. Mutaciones: `changeStatus` (valida `canTransition`,
sella `actual_start`/`actual_end`; al `pending_cab` notifica `change_manager`; al `closed` captura KB via
`captureClosureKnowledge`), `cabDecision` (guard `change.approve`, requiere estado `pending_cab`, setea
`status=approved|rejected`, `cab_decision*`). Estados: draft->assessment->pending_cab->approved->scheduled->
implementing->review->closed (+ rejected, cancelled). La decision CAB (approved/rejected) NO es transicion
de gestion; se aplica aparte. RLS + ledger `change_request`.

**7. Flujos clave.** Avanzar el RFC hasta CAB -> CAB aprueba/rechaza -> programar -> implementar ->
review -> cerrar (KB draft). Ventana planificada valida `fin >= inicio` (validacion §16).

**i18n.** Claves `chg.*`, `inc.section.ledger`.

---

## 15. `/changes/[id]/edit` — Editar Cambio

**1. Ruta y parametros.** `app/(app)/changes/[id]/edit/page.tsx`. Param `id`.

**2. Modulo/categoria.** Macro "Evolucion".

**3. Proposito.** Editar el RFC (titulo, tipo, riesgo, justificacion, planes, servicio/CI, incidente/
problema relacionado, ventana planificada inicio/fin).

**4. Roles y permisos.** **Guard duro**: `if (!change.manage) redirect(/changes/[id])`. `updateChange`
re-valida `change.manage`.

**5. Pantalla.** `ChangeForm` con `initial` (fechas convertidas a `datetime-local` con `toLocal`).

**6. Funcional/tecnico.** `updateChange` (guard + `validateChange`: titulo>=5, tipo/riesgo validos,
y **`plannedEnd >= plannedStart`** —espeja CHECK de BD, ambos sentidos). `getChangeFormOptions` (servicios,
apps). RLS + ledger.

**7. Flujos clave.** Ajustar planes y ventana antes de CAB.

**i18n.** Claves `chg.f.*`.

---

## 16. `/changes/new` — Nuevo Cambio

**1. Ruta y parametros.** `app/(app)/changes/new/page.tsx`. Query **`?incident=<id>`** y **`?problem=<id>`**
para pre-ligar el cambio a su origen. Quick action `qa.newChange` (perm `change.manage`).

**2. Modulo/categoria.** Macro "Evolucion".

**3. Proposito.** Alta de un RFC, opcionalmente ya vinculado a un incidente o problema.

**4. Roles y permisos.** **Guard duro**: `if (!change.manage) redirect(/changes)`. `createChange` re-valida.

**5. Pantalla.** `ChangeForm` con `initial` (`relatedIncidentId`/`relatedProblemId` desde query, defaults
`changeType=normal`, `riskLevel=medium`).

**6. Funcional/tecnico.** `createChange` inserta `status="draft"`, `requested_by=created_by=ctx.accountId`,
numeracion `change_number` por trigger. `toRow` normaliza. Validacion `validateChange`.

**7. Flujos clave.** Desde el detalle de un problema (boton -> `/changes/new?problem=<id>`) o incidente,
crear el cambio de remediacion ya ligado.

**i18n.** Claves `chg.*`.

---

## 17. `/squads` — Listado de Squads

**1. Ruta y parametros.** `app/(app)/squads/page.tsx`. Sin parametros; vista cards/table es estado cliente.

**2. Modulo/categoria.** Macro "Evolucion" (`nav.squads`, path `/squads`, perm `squad.read`,
`absorbedInHub:true`). En `EVOLUTION_NAV` grupo `ev.ejecucion`.

**3. Proposito.** Directorio de squads con salud de capacidad (carga demanda/capacidad), FTE, PO, tipo
(domain/enabler/transient) y top backlog. Alta rapida inline (con permiso).

**4. Roles y permisos.** Ruta `squad.read`. `canManage = squad.manage` (people_lead, change_manager,
system_admin, tenant_admin — y product_owner por `sql/0091`). Denegado por persona a
squad_member/support_agent/support_lead (`ROLE_ROUTE_DENY` incluye `/squads`).

**5. Pantalla** (`components/squads/squad-list.tsx`):
- Intro + toggle cards/tabla + boton "Nuevo squad" (si canManage) que abre form inline
  (code, name, BU, capacidad, transversal).
- `FilterBar`/`GroupBar` (BU, transversal).
- **Vista cards**: `SquadCardView` con salud (dot), tipo, tribu/BU, barra de carga
  (`demand_points/capacity_points · load_pct%`), PO (alerta si falta), avatares del roster, FTE, top backlog.
- **Vista tabla**: nombre, tipo, BU, FTE, carga, PO, # miembros. Filas a `/squads/[id]`.

**6. Funcional/tecnico.** Datos: `getSquadCards` (`lib/capacity/queries` — FUENTE UNICA de carga/FTE),
`getBusinessUnitOptions`, `getAccessControl`. Mutacion: `createSquad` (guard `squad.manage`, valida
`validateSquad` code>=2/name>=3/capacity 1..999, **control de duplicados en 3 capas**: chequeo previo por
`(tenant_id, code)` + UNIQUE BD `23505` + validacion form). RLS `squad_isolation` + `audit_row_change()`
(`sql/0021_squads.sql`).

**7. Flujos clave.** Ver carga por squad; crear squad; entrar al Squad 360.

**i18n.** Claves `sq.*`, `tribe.type.*`, `init.type.*`.

---

## 18. `/squads/[id]` — Squad 360

**1. Ruta y parametros.** `app/(app)/squads/[id]/page.tsx`. Param `id`.

**2. Modulo/categoria.** Macro "Evolucion".

**3. Proposito.** Ficha 360 del squad: dominio/mision + liderazgo (PO, business owner, tech lead, agile
lead), capacidad vs demanda, backlog/actividad de iniciativas, roster editable, y alertas de sobre-asignacion.

**4. Roles y permisos.** Ruta `squad.read`. `canManage = squad.manage` habilita alta/edicion/baja de
roster. La **edicion de la ficha maestra** enruta a `/catalog/squads/[id]/edit` (Datos Maestros), no a una
ruta bajo `/squads`.

**5. Pantalla** (`components/squads/squad-detail.tsx`):
- Hero: code + nombre + tipo (domain/enabler/transient) + tribu (link a `/evolucion/mapa`) + transversal +
  Editar (-> `/catalog/squads/[id]/edit`).
- **KPIs**: BU, FTE (personas), carga (`demand/capacity · load%`), capacidad en puntos.
- **`Squad360`**: tarjeta gobierno (mision + 4 lideres + run/change) con anillo de completitud y CTA
  "Asignar" (-> edit) si falta; tarjeta backlog (demanda/capacidad + iniciativas abiertas con WSJF, dot
  bloqueado/lead); tarjeta actividad (iniciativas activas).
- **Roster**: tabla (miembro, rol, disciplina, allocation %) con alta (selector `assignable` + rol +
  allocation), edicion inline y baja. Badge EXT y "sobre-asignado" (>100% total entre squads).

**6. Funcional/tecnico.** Datos: `getSquad`, `getSquadRoster`, `getAssignableMembers`,
`hasPermission("squad.manage")`, `getSquadLeads` (resuelve uuids de lideres contra `user_account`),
`getSquadInitiatives` (via `project_squad`, marca `blocked` si hay `project_risk` blocker/critico),
`getSquadCapacities`, y query de `squad_member` activos para sobre-asignacion. Mutaciones: `addSquadMember`,
`updateSquadMember`, `removeSquadMember` (soft-delete a `inactive`, la persona pudo participar en trabajo
referenciado). Validacion `validateSquadMember` (rol valido, allocation 0..100). Duplicado por
`(squad, member)` -> `23505` -> `ErrorCode.DUPLICATE`. RLS + ledger `squad`/`squad_member`.

**7. Flujos clave.** Completar la ficha de gobierno; gestionar el roster; ver carga y backlog priorizado;
detectar personas sobre-asignadas.

**i18n.** Claves `sq.*`, `sq360.*`, `sq.role.*`.

---

## 19. `/observability` — Centro de Observabilidad

**1. Ruta y parametros.** `app/(app)/observability/page.tsx`. Sin parametros; pestana alerts/dx es estado cliente.

**2. Modulo/categoria.** Macro "Evolucion" (`nav.observability`, path `/observability`, perm
`observability.read`). **NO aparece en `EVOLUTION_NAV`** — visible solo en `MACRO_NAV` (admin/multi-persona).

**3. Proposito.** Monitoreo sensor->caso: alertas de monitoreo (correlacionar/crear caso ancla) y eventos
de experiencia digital (journeys, error/latencia).

**4. Roles y permisos.** Ruta `observability.read` (support_agent, support_lead, change_manager, auditor,
ai_agent, system_admin, tenant_admin). `canManage = observability.manage` (support_agent, support_lead,
change_manager, system_admin, tenant_admin) habilita acciones sobre alertas. Denegado por persona a
support_agent (`ROLE_ROUTE_DENY`).

**5. Pantalla** (`components/observability/observability.tsx`): dos pestanas.
- **Alertas** (`alerts-tab.tsx`): KPIs (abiertas, criticas, reconocidas, correlacionadas) + `FilterBar`
  (severidad, estado, fuente) + tabla (severidad, titulo con caso/vendor correlacionado, fuente, sistema,
  ocurrencias, estado, ultima vez, acciones). Acciones (si canManage): **Reconocer** (`acknowledgeAlert`),
  **Crear caso** (`createCaseFromAlert`), **Resolver** (`resolveAlert`), y ver caso correlacionado.
- **Experiencia digital** (`dx-tab.tsx`): KPIs (eventos, %error, %lento, ms promedio) + salud por recorrido
  (barra de %error) + `FilterBar` (canal, journey, estado) + tabla de eventos.

**6. Funcional/tecnico.** Datos: `listAlerts` (tabla `monitoring_alert`, joins correlacion/vendor/service),
`listDxEvents` (tabla `digital_experience_event`, agregados por journey). Mutaciones:
`acknowledgeAlert`/`resolveAlert`/`correlateAlert` (guard `observability.manage`, validaciones de estado en
`lib/observability/validation.ts`). **`createCaseFromAlert`** llama al RPC atomico `create_case_from_alert`
(`sql/0056_observability.sql`): en una sola transaccion crea el **incidente ancla** (la comunicacion/tracking
queda anclada al caso) y correlaciona la alerta; el ledger y ambas filas se confirman/revierten juntos
(audit-grade §11). RLS `alert_isolation`/`dx_isolation` + `audit_row_change()`.

**7. Flujos clave.** Sensor dispara alerta -> reconocer -> **crear caso ancla** (entra a Operaciones) o
correlacionar con un caso existente -> resolver. Monitorear salud de journeys por %error/latencia.

**i18n.** Claves `obs.*`, `obs.dx.*`.

---

## 20. `/dependencies` — Grafo de dependencias de servicios

**1. Ruta y parametros.** `app/(app)/dependencies/page.tsx`. Sin parametros; servicio seleccionado es
estado cliente.

**2. Modulo/categoria.** Macro "Evolucion" (`nav.dependencies`, path `/dependencies`, perm **`cmdb.read`**).
**NO aparece en `EVOLUTION_NAV`** — solo `MACRO_NAV`.

**3. Proposito.** Mapa de dependencias service->service con "blast radius": impacto operativo (incidentes
activos) por servicio, CIs y productos asociados, y gestion inline de aristas (con permiso).

**4. Roles y permisos.** Ruta `cmdb.read`. `canManage = cmdb.manage` (editor de dependencias). Denegado por
persona a support_agent (`ROLE_ROUTE_DENY` incluye `/dependencies`).

**5. Pantalla** (`components/dependencies/dependency-graph.tsx`):
- KPIs: servicios, aristas, servicios afectados, incidentes activos.
- Columna izq: servicios agrupados por dominio (dot rojo si tiene incidentes activos, criticidad).
- Columna der (`ImpactPanel`): nombre + criticidad; **Depende de** / **Es dependencia de** (chips
  navegables); CIs y productos asociados; **incidentes activos** (via service o via CI); editor
  `DependencyEditor` (si canManage): agregar arista (depends_on + tipo + criticidad) / quitar.

**6. Funcional/tecnico.** Datos: `getDependencyGraph` arma el grafo sobre datos reales (`service`,
`service_dependency`, `configuration_item`, `incident`, `product`) via `buildGraph`
(`lib/dependencies/graph.ts`). Mutaciones: `addDependency` (guard `cmdb.manage`; valida self/tipo/duplicado
en 3 capas + **deteccion de ciclo** `wouldCreateCycle` contra la topologia actual; verifica que ambos
servicios existen en el tenant; duplicado `23505` -> `DUPLICATE`; ciclo -> `ErrorCode.STATE`),
`removeDependency`. RLS `svcdep_isolation` + `audit_row_change()` (`sql/0058_service_dependency.sql`).

**7. Flujos clave.** Seleccionar servicio -> ver blast radius e incidentes activos -> declarar/quitar
dependencias evitando ciclos.

**i18n.** Claves `dep.*`, `lvl.*`, `cmdb.type.*`.

---

## 21. `/vendors` — Listado / Scorecard de proveedores

**1. Ruta y parametros.** `app/(app)/vendors/page.tsx`. Sin parametros; vista lista/scorecard es cliente.

**2. Modulo/categoria.** Macro "Evolucion" (`nav.vendors`, path `/vendors`, perm `vendor.read`). En
`EVOLUTION_NAV` grupo `ev.ejecucion`.

**3. Proposito.** Gestion de proveedores: catalogo con criticidad, sistemas asociados, contratos por vencer,
y un **scorecard** de senales objetivas (incidentes abiertos, incidentes 90d, alertas, disputas, expiracion).

**4. Roles y permisos.** Ruta `vendor.read` (support_agent, support_lead, auditor, ai_agent, system_admin,
tenant_admin, change_manager, grc_officer, **product_owner**). `canManage = vendor.manage` (change_manager,
grc_officer, system_admin, tenant_admin, product_owner por `sql/0091`).

**5. Pantalla** (`components/vendors/vendor-list.tsx`): header + toggle lista/scorecard + boton "Nuevo"
(si canManage). KPIs (activos, criticos, por vencer <=90d). **Lista**: `FilterBar`/`GroupBar` (categoria,
criticidad, estado) + tabla (nombre/code, categoria, criticidad, # sistemas, **senales** incidentes/alertas/
disputas, estado), ordenada por criticidad y # sistemas. **Scorecard**: tabla de senales agregadas por
proveedor con expiracion coloreada.

**6. Funcional/tecnico.** Datos: `listVendors` (tabla `vendor` + conteo `configuration_item`),
`getVendorScorecard` (RPC `vendor_scorecard` SECURITY DEFINER, gate `vendor.read` + tenant, solo agregados;
`sql/0095_vendor_scorecard.sql`). RLS `vendor_isolation` + `audit_row_change()` (`sql/0047_vendor_management.sql`).

**7. Flujos clave.** Priorizar proveedores por criticidad/senales; entrar al detalle; crear proveedor.

**i18n.** Claves `vnd.*`, `vsc.*`.

---

## 22. `/vendors/[id]` — Detalle de proveedor

**1. Ruta y parametros.** `app/(app)/vendors/[id]/page.tsx`. Param `id`.

**2. Modulo/categoria.** Macro "Evolucion".

**3. Proposito.** Ficha del proveedor: datos y contacto, contrato/SLA, sistemas (CIs) que provee, e
incidentes que afectan esos sistemas (senal de desempeno). Activar/desactivar (soft delete).

**4. Roles y permisos.** Ruta `vendor.read`. `canManage = vendor.manage` (editar + activar/desactivar).

**5. Pantalla** (`components/vendors/vendor-detail.tsx`): cabecera (code, nombre, criticidad, estado) +
Editar / Activar-Desactivar. Tarjetas: detalle (legal, categoria, contacto, email, telefono, web);
contrato (numero, inicio, fin, SLA); sistemas asociados; incidentes (link a `/incidents/[id]`).

**6. Funcional/tecnico.** Datos: `getVendor`, `getVendorSystems` (`configuration_item` por `vendor_id`),
`getVendorIncidents` (incidentes cuyo `affected_ci_id` pertenece al proveedor). Mutaciones:
`deactivateVendor`/`reactivateVendor` (soft delete a `inactive`/`active`, guard `vendor.manage`; el
proveedor puede estar referenciado por CIs). RLS + ledger `vendor`.

**7. Flujos clave.** Revisar contrato y desempeno; desactivar sin borrar fisicamente.

**i18n.** Claves `vnd.*`.

---

## 23. `/vendors/[id]/edit` — Editar proveedor

**1. Ruta y parametros.** `app/(app)/vendors/[id]/edit/page.tsx`. Param `id`.

**2. Modulo/categoria.** Macro "Evolucion".

**3. Proposito.** Editar la ficha del proveedor.

**4. Roles y permisos.** **Guard duro**: `if (!vendor.manage) redirect(/vendors/[id])`. `updateVendor`
re-valida.

**5. Pantalla.** `VendorForm` (`components/vendors/vendor-form.tsx`) con `initial` derivado del proveedor.

**6. Funcional/tecnico.** `updateVendor` (guard + `validateVendor`: code>=2, name>=2, categoria/criticidad
validas, email valido si viene, **`contractEnd >= contractStart`** —espeja CHECK BD; duplicado `23505` ->
`DUPLICATE`). RLS + ledger.

**7. Flujos clave.** Actualizar contrato/contacto/criticidad.

**i18n.** Claves `vnd.f.*`, `vnd.cat.*`.

---

## 24. `/vendors/new` — Nuevo proveedor

**1. Ruta y parametros.** `app/(app)/vendors/new/page.tsx`. Sin parametros.

**2. Modulo/categoria.** Macro "Evolucion".

**3. Proposito.** Alta de proveedor.

**4. Roles y permisos.** **Guard duro**: `if (!vendor.manage) redirect(/vendors)`. `createVendor` re-valida.

**5. Pantalla.** `VendorForm` sin `initial` (defaults `category=saas`, `criticality=medium`).

**6. Funcional/tecnico.** `createVendor` inserta con `created_by`, numeracion `code`? por trigger
`set_vendor_code` (BD). Validacion `validateVendor`. RLS + ledger.

**7. Flujos clave.** Crear -> revalida `/vendors`.

**i18n.** Claves `vnd.*`.

---

## Hallazgos transversales (3-5)

1. **El ancla incidencia->evolucion->proyecto es real y coherente en todo el cluster.** `sendToEvolution`
   (requiere `incident.assign`/`triage.manage`, NO el operador) fija el incidente en `status="in_evolution"`
   sin cerrarlo, deja comentario visible al partner y notifica a `product_owner`. `convertRecommendation`
   crea el `project` con `created_from_incident_id` + `project_incident_link (source)`. El detalle de
   proyecto (`getAnchorCaseContext`) reproyecta en SOLO LECTURA el caso y sus comentarios `partner`
   (el hilo con el cliente sobrevive). `/casos-convertidos` (RPC `converted_cases`) da la trazabilidad
   punta a punta y pinta el chip `in_evolution`. Al **completar** la evolucion se notifica a la mesa
   (support_lead + responsable_comercial) — el ciclo se cierra donde empezo (§0).

2. **Audit-grade por trigger de BD, no por escritura explicita de la app.** Todas las tablas del cluster
   (`project`, `project_task`, `project_incident_link`, `project_squad`, `project_risk`, `project_validation`,
   `problem`, `problem_incident`, `change_request`, `squad`, `squad_member`, `vendor`, `monitoring_alert`,
   `digital_experience_event`, `service_dependency`) tienen trigger `audit_row_change()` (ledger inmutable)
   + RLS `*_isolation` por `current_tenant_id()`. Los detalles de Problema y Cambio **renderizan el ledger
   inline** (`getLedgerForEntity`). `create_case_from_alert` es explicitamente atomico (caso + correlacion +
   ledger en una transaccion).

3. **Inconsistencia de gating en Proyectos (posible riesgo de defensa en profundidad).** A diferencia de
   Problemas/Cambios/Vendors/Squads —que hacen `redirect` en las paginas `new`/`edit` y re-validan el
   permiso en cada server action (`guard(perm)`)— las mutaciones core de proyecto
   (`createProject`, `updateProject`, `softDeleteProject`, `changeProjectStatus`) **solo validan
   `ctx.tenantId`, no `project.manage`**, y las paginas `/projects/new` y `/projects/[id]/edit` **no tienen
   `redirect` por permiso**. La proteccion efectiva recae en RLS + gating de UI (`canManage`). Las
   sub-acciones de squads/riesgos SI usan `canManageProject()`, y QA usa `guard("project.validate"/"deploy")`.
   Vale confirmar con el arquitecto si es intencional (RLS suficiente) o una brecha a cerrar.

4. **Segregacion por persona vs. permiso: `/observability` y `/dependencies` quedan fuera de la persona de
   Evolucion.** `EVOLUTION_NAV` (Gerente de Evolucion / `product_owner`) NO incluye observabilidad ni
   dependencias; esas dos pantallas solo aparecen en `MACRO_NAV` (admin o usuario multi-persona), y su
   acceso depende de `observability.read`/`cmdb.read` (perfiles de Operaciones/CMDB), reforzado por
   `ROLE_ROUTE_DENY` para support_agent. La segregacion combina overlay de nav (`navForRoles`/`solePersona`)
   + denylist de ruta + `perm` por item; un multi-persona es power-user y recibe la nav completa.

5. **"Fuente unica" de capacidad y cero-hardcode consistentes.** La carga/demanda/FTE por squad y tribu sale
   siempre de `lib/capacity` (mismos numeros en Torre `/evolucion`, `/projects/portafolio`, `/squads` y
   Squad 360). Los formularios consumen catalogos reales (servicios/CI/categorias/BU/squads activos) y las
   validaciones se espejan en 3 capas (form + server action + CHECK/UNIQUE de BD), incluyendo duplicados
   (`23505 -> DUPLICATE`), ciclos de dependencia (`wouldCreateCycle`) y rangos de fechas bidireccionales
   (contratos de vendor y ventana planificada de cambios). i18n integral: todo copy visible pasa por
   `useI18n`/`t(MessageKey)` con formato locale-aware (`es-CR`/`en-US`, moneda `CRC`); no se detectaron
   textos quemados en las pantallas de este cluster.


---

# Clúster D — Talento + Conocimiento + IA

# Documentacion Cluster D — Talento + Conocimiento + IA + Reglas/Workflows + Procesos

> Fuente: codigo real del repositorio Credix Nexus (Next.js 16 App Router + Supabase).
> Todo lo aqui descrito sale de archivos verificados (rutas citadas). Lo no confirmable
> empiricamente en codigo se marca **(no verificado)**.
> Nota i18n: toda la UI de estas pantallas usa `useI18n()` + `t(clave)` con diccionarios
> ES/EN en `lib/i18n/dictionaries.ts` (§11 "i18n real"); no hay copy quemado en los componentes revisados.

---

## Indice de pantallas

| # | Ruta | Modulo macro | Componente raiz |
|---|------|--------------|-----------------|
| 1 | `/talent` | Talento | `components/team/agents-and-load.tsx` (fusion) |
| 2 | `/talent/[id]` | Talento | `components/talent/member-detail.tsx` |
| 3 | `/workload` | Talento (Recursos) | `components/workload/workload-view.tsx` + `simulation.tsx` |
| 4 | `/delivery-areas` | Talento (Areas) | `components/areas/area-list.tsx` |
| 5 | `/knowledge` | Conocimiento | `kb-browser.tsx` (curador) / `user-knowledge.tsx` (usuario) |
| 6 | `/knowledge/[id]` | Conocimiento | `components/knowledge/article-view.tsx` |
| 7 | `/knowledge/revision` | Conocimiento | `components/knowledge/kb-review-board.tsx` |
| 8 | `/ai-center` | Conocimiento | `components/ai/ai-center.tsx` |
| 9 | `/rules` | Conocimiento | `recommendations-queue.tsx` + `rule-config.tsx` |
| 10 | `/workflows` | Conocimiento | `components/workflows/workflows.tsx` |
| 11 | `/workflows/[id]` | Conocimiento | `components/workflows/instance-detail.tsx` |
| 12 | `/workflows/definitions/[id]` | Conocimiento | `components/workflows/definition-detail.tsx` |
| 13 | `/processes` | Administracion | `components/process/process-governance.tsx` |
| 14 | `/processes/[id]` | Administracion | `components/process/process-card.tsx` |

> Aviso de agrupacion: aunque el cluster se titula "Procesos", en `navigation.ts` la ruta
> `/processes` cuelga de la categoria macro **Administracion** (`nav.processes`, perm `process.read`,
> `absorbedInHub`), no de Conocimiento. `/rules`, `/workflows`, `/ai-center`, `/knowledge` si viven en
> la categoria macro **Conocimiento**. `/talent`, `/workload` (Recursos) y `/delivery-areas` (Areas)
> viven en la categoria macro **Talento**.

---

## Modelo de permisos (transversal a las 14 pantallas)

Gate de ruta declarado en `lib/nav/access.ts` (`ROUTE_PERMISSIONS`) y visibilidad de sidebar en
`lib/nav/navigation.ts` (`MACRO_NAV`, campo `perm`). El permiso de RUTA es la lectura minima; las
acciones (mutaciones) exigen permisos adicionales verificados en el server action con
`hasPermission(...)`.

| Ruta | Perm de ruta (`ROUTE_PERMISSIONS`) | Perm de gestion/accion |
|------|-----------------------------------|------------------------|
| `/talent` | `talent.read` | `talent.manage` (alta/edicion/skills/eval) |
| `/workload` | `squad.read` | (solo lectura + simulacion cliente) |
| `/delivery-areas` | `area.read` | `area.manage` (editar lider/adjunto/descripcion) |
| `/knowledge` | `knowledge.read` | `knowledge.manage` (curador) / `knowledge.feedback` (votar) |
| `/knowledge/revision` | `knowledge.manage` | `knowledge.manage` (publicar/descartar) |
| `/ai-center` | `["incident.read","ai.read"]` (any-of) | (bitacora solo lectura; acciones IA viven en el detalle del caso) |
| `/rules` | `rule.read` | `recommendation.decide` (RC decide); motor exige `incident.update`/`triage.manage` |
| `/workflows` | `workflow.read` | `workflow.manage` (disenar) / `workflow.run` (ejecutar) |
| `/processes` | `process.read` | `process.manage` (vincular sistema/canal) |

Segregacion por persona (denylist de capa de aplicacion, `ROLE_ROUTE_DENY` en `access.ts`), solo si
el usuario es de UNA sola persona interna (`solePersona`):
- **support_lead** (Gerente de Operaciones): vetado `/rules`, `/ai-center`, `/delivery-areas` (entre otros). Conserva `/talent`, `/workload`.
- **squad_member**: vetado `/rules`, `/ai-center`, `/workload` (usa rutas `/mi-*`).
- **support_agent** (Operador): vetado `/rules`, `/workflows`, `/ai-center`, `/talent`, `/workload`, `/delivery-areas`, `/processes`. Conserva `/knowledge`.
- **product_owner** (Gerente de Evolucion): recibe reagrupamiento `EVOLUTION_NAV` con `nav.aicenter`, `nav.rules`, `nav.workflows`, `nav.processes`, `nav.talent`, `nav.resources` en su menu.
- **admin**: siempre `MACRO_NAV` completo (sin denylist).

Auditoria (ledger) y RLS confirmados a nivel BD por dominio (triggers `audit_row_change()` que emiten
`immutable_audit_event`, y `enable row level security` por tabla):
- Talento: `sql/0030_talent.sql` (audit x2, RLS x4).
- Workflows: `sql/0044_workflow_engine.sql` (audit x5 sobre definition/node/edge/instance/step, RLS x5).
- Procesos: `sql/0065_process_governance.sql` (audit x2, RLS x2).
- Areas: `sql/0051_delivery_area.sql` (audit x1, RLS x1).
- Conocimiento: `sql/0018_knowledge.sql` + `sql/0060_kb_living.sql` (audit, RLS).
- Reglas: `sql/0019_rule_engine.sql` (audit sobre `rule`, `rule_version`, `rule_evaluation`, `project_recommendation`, `governance_item`; RLS).

---

## 1. `/talent` — Agentes (Talento) + pestana Carga

### 1.1 Ruta y parametros
`app/(app)/talent/page.tsx`. Sin parametros. Server component.

### 1.2 Modulo/categoria
Categoria macro **Talento** (`nav.talent`, perm `talent.read`). Persona natural: Gerencia /
Operaciones (support_lead) y Evolucion (product_owner). Es una **fusion "Agentes y carga" (Fase B)**:
combina Talento (Agentes) con Workload (Carga) en una sola pantalla con pestanas.

### 1.3 Proposito
Directorio de profesionales (internos y externos) con sus competencias, experiencia, disciplina,
seniority, carga de casos abiertos y metricas de desempeno (efectividad/empatia). Para quien tiene
`squad.read`, agrega una pestana "Carga" que replica `/workload` (distribucion + simulacion). Es el
punto de gestion de talento y capacidad del equipo.

### 1.4 Roles y permisos
- Ruta: `talent.read`.
- Pestana **Carga** visible solo si `(isAdmin || perms.includes("squad.read")) && !isRouteDeniedForRoles("/workload", roles)` (replica el control de `/workload`). Sin `squad.read` se ve solo Agentes (`AgentsAndLoad` renderiza solo `TalentList`).
- Boton de gestion (alta de miembro): `canManage = isAdmin || perms.includes("talent.manage")`.

### 1.5 Pantalla
- Componente fusion `components/team/agents-and-load.tsx` (usa `TabbedScreen`). Pestanas: `agentes` (`TalentList`) y `carga` (`WorkloadView` + `Simulation`).
- `components/talent/talent-list.tsx`: tabla de agentes con columnas nombre/stream/tipo/disciplina/skills/experiencia/casos abiertos/efectividad/empatia/carga. Filtros (`useListFilters`/`FilterBar`) por stream (delivery_area), tipo (internal/external), disciplina; agrupacion (`useGrouping`/`GroupBar`); busqueda de texto. Fila enlaza a `/talent/[id]`.
- Accion **crear miembro** (si `canManage`): formulario con nombre, email, es-externo + tipo externo (`subcontractor`/`intelix`), delivery area (stream), disciplina, seniority, capacityPoints. Llama `createMember`.

### 1.6 Funcional/tecnico
- Queries (`lib/talent/queries.ts`):
  - `getTalentProfiles`: join de `team_member` + `member_skill` (skill:skill_id) + `member_expertise` + `incident` (casos abiertos por `assigned_member_id`, estados OPEN) + `member_evaluation` (promedios `performance_score`/`empathy_score`). Deriva stream desde `delivery_area` (code/name/lead_name).
  - `getTalentAreas`: `delivery_area` activos (selector de stream).
  - Carga por persona = `workload.members[].taskPoints` (misma fuente que `/workload`, §0).
- Estados OPEN de incidente: `["new","received","triaged","assigned","in_progress","waiting","reopened","in_evolution"]`.
- Mutacion `createMember` (`lib/talent/actions.ts`): guard `talent.manage` (`talentGuard`), `validateMember`, control de duplicado de email case-insensitive por tenant (`emailTaken`, no borrados), insert en `team_member` con `tenant_id`, `created_by/updated_by`.
- Validacion (`lib/talent/validation.ts`): `validateMember` exige nombre >=3, deliveryAreaId requerido, externalType requerido si isExternal (y prohibido si no), email valido, capacityPoints entero 1-40.
- RLS/tenant: `tenant_id` en todo insert; RLS por tenant en `team_member`.

### 1.7 Flujos clave
1. Alta de agente: FilterBar -> boton crear -> `createMember` (valida + dedup email) -> `revalidatePath("/talent")`.
2. Consulta de carga: pestana Carga (si squad.read) -> `getWorkload` + `getSquadCapacities` + `getSimulationInputs`.

---

## 2. `/talent/[id]` — Detalle del profesional

### 2.1 Ruta y parametros
`app/(app)/talent/[id]/page.tsx`. Param `id` (uuid de `team_member`). `notFound()` si no existe.

### 2.2 Modulo/categoria
Sub-ruta de Talento. No aparece como item de nav propio (se navega desde `/talent`).

### 2.3 Proposito
Ficha 360 de un profesional: perfil editable, competencias (skills con nivel 1-5), experiencia en
maestros (proceso/BU/producto/canal/CI/servicio), evaluaciones (general / al cierre de caso o
proyecto) con efectividad y empatia, y conteo de casos abiertos. Permite mantener el talento y su
desempeno historico.

### 2.4 Roles y permisos
- Ruta hereda `talent.read`. `canManage = isAdmin || perms.includes("talent.manage")` habilita edicion, alta/baja de skills/experiencia/evaluaciones y activar/desactivar.

### 2.5 Pantalla
`components/talent/member-detail.tsx`. Layout de 2 columnas:
- Cabecera: nombre, badge interno/externo (+ tipo externo), estado (inactivo), boton activar/desactivar (con `confirm`).
- `ProfileCard`: edicion de datos (nombre, email, externo, stream, disciplina, seniority, capacity) -> `updateMember`.
- `SkillsCard`: alta (`addMemberSkill`) / baja (`removeMemberSkill`) de skills desde catalogo real `skill`.
- `ExpertiseCard`: alta (`addMemberExpertise`) / baja (`removeMemberExpertise`) por `entity_type` con selects de maestros reales (muestra nombre descriptivo, no id).
- `EvalsCard`: alta (`addMemberEvaluation`) / baja (`deleteMemberEvaluation`) de evaluaciones (tipo, efectividad 0-100, empatia 0-100, comentario, entidad).

### 2.6 Funcional/tecnico
- `getMemberDetail`: `team_member` + area + `member_skill` (skill:skill_id id/name/category) + `member_expertise` + `member_evaluation` (evaluador:evaluator_user_id) + count de casos abiertos.
- `getTalentOptions`: catalogos reales para formularios — `skill`, `delivery_area`, y `entities` por tipo: `process`, `business_unit`, `product`, `channel`, `configuration_item`, `service`.
- Mutaciones (`lib/talent/actions.ts`, todas gated `talent.manage`):
  - `updateMember` (revalida dedup email excluyendo el propio id).
  - `setMemberStatus` — **soft delete** logico (active/inactive), no borra fisico (el profesional pudo atender casos referenciados).
  - `addMemberSkill`/`removeMemberSkill` — dedup por (member_id, skill_id), nivel 1-5.
  - `addMemberExpertise`/`removeMemberExpertise` — dedup por (member_id, entity_type, entity_id), nivel 1-5; entityType ∈ EXPERTISE_ENTITIES.
  - `addMemberEvaluation` — `member_evaluation` con `performance_score`/`empathy_score`, period = hoy, `evaluator_user_id`.
- Validaciones: `validateSkill`, `validateExpertise`, `validateEvaluation` (score 0-100, exige al menos un dato, entidad requerida si eval_type != general).
- Recomendador de asignacion (`lib/talent/recommender.ts`, `suggestForIncident`): fit data-driven `0.5*experiencia(CI) + 0.3*habilidad(categoria.related_skill_id) + 0.2*disponibilidad(carga)`, top 4. Se usa via `suggestAssignees` (opt-in) y el panel `components/talent/fit-panel.tsx` en el detalle del caso (no en esta pantalla).

### 2.7 Flujos clave
Editar perfil / gestionar skills-experiencia / registrar evaluacion, cada uno con mensaje de exito y
`router.refresh()`. Desactivacion pide confirmacion.

---

## 3. `/workload` — Recursos (carga + simulacion)

### 3.1 Ruta y parametros
`app/(app)/workload/page.tsx`. Sin parametros.

### 3.2 Modulo/categoria
Categoria macro **Talento**, item `nav.resources` (perm `squad.read`). Sigue existiendo como ruta
propia para roles que no ven la fusion de `/talent`.

### 3.3 Proposito
Vision de carga de trabajo: por persona (casos abiertos + puntos de tareas) y por squad (demanda vs
capacidad canonica), mas un simulador de horizonte/capacidad para planificar sprints del backlog.

### 3.4 Roles y permisos
Ruta `squad.read`. Solo lectura + simulacion (calculo en cliente). No hay mutaciones.

### 3.5 Pantalla
- `components/workload/workload-view.tsx`: KPIs (casos abiertos, puntos de tareas, miembros con carga, sobre-capacidad), tabla por persona (casos/tareas/puntos/squads, con badge "Equipo Transversal"), y tabla/cards por squad (capacidad canonica, demanda, % carga, over). Usa tono por carga (`lib/capacity/compute` `loadTone/toneColor`).
- `components/workload/simulation.tsx`: controles cliente — horizonte (sprints), % capacidad extra, incluir activos; calcula demanda/capacidad/gap/sprints por squad. `RESOURCE_CAP=8` (capacidad de referencia por recurso; **no verificado** si espeja un default de BD).

### 3.6 Funcional/tecnico
- `getWorkload` (`lib/workload/queries.ts`): `team_member` activos, `incident`, `project_task`, `project`, `squad` activos, `squad_member` activos. Carga persona = casos abiertos + suma `effort_points` de tareas no `done`. Demanda squad = tareas no `done` cuyo `project.squad_id` = squad.
- `getSquadCapacities` (`lib/capacity/queries.ts`): **fuente unica de verdad** de demanda/capacidad de squads (§0). demanda = `effort_points` de tareas abiertas via `project.squad_id`; capacidad = `squad.capacity_points`; FTE = suma `allocation_pct`/100. Deriva tribe/BU/PO.
- `getSimulationInputs` (`lib/workload/simulation.ts`): squads activos + backlog de `project` en estados `proposed/approved/active/on_hold` con `job_size`/`wsjf`.

### 3.7 Flujos clave
Lectura + simulacion interactiva sin persistencia (todo cliente sobre datos reales).

---

## 4. `/delivery-areas` — Areas de entrega

### 4.1 Ruta y parametros
`app/(app)/delivery-areas/page.tsx`. Sin parametros.

### 4.2 Modulo/categoria
Categoria macro **Talento**, item `nav.areas` (perm `area.read`).

### 4.3 Proposito
Gobierno de las areas/streams de entrega (Operaciones y Evolucion): responsable (lider) y adjunto,
descripcion y conteos de incidentes/proyectos asociados. Es la estructura organizativa a la que se
adscriben los profesionales.

### 4.4 Roles y permisos
Ruta `area.read`. Edicion gated `area.manage` (`canManage`).

### 4.5 Pantalla
`components/areas/area-list.tsx`: grid de tarjetas (`AreaCard`) por area con codigo (color operations/
evolution), nombre, descripcion, lider (nombre/email), adjunto (nombre/email) y conteos incidentes/
proyectos. Modo edicion inline si `canManage`.

### 4.6 Funcional/tecnico
- `listDeliveryAreas` (`lib/areas/queries.ts`): `delivery_area` no borradas + counts embebidos `incident(count)` y `project(count)`.
- Mutacion `updateDeliveryArea` (`lib/areas/actions.ts`): guard `area.manage`, valida emails (lead/deputy) con `emailValidator`, actualiza descripcion/lider/adjunto, `updated_by`. Nota: **solo update** — no hay alta ni baja de areas por UI (el maestro se administra en otro lado o por seed; **no verificado** un CRUD de alta).
- RLS por tenant sobre `delivery_area`.

### 4.7 Flujos clave
Editar responsable/adjunto/descripcion de un area -> `updateDeliveryArea` -> `revalidatePath("/delivery-areas")`.

---

## 5. `/knowledge` — Base de conocimiento (KB viva)

### 5.1 Ruta y parametros
`app/(app)/knowledge/page.tsx`. Sin parametros. **Render dual segun rol**.

### 5.2 Modulo/categoria
Categoria macro **Conocimiento**, item `nav.knowledge` (perm `knowledge.read`). Es transversal
(tambien accesible por Operador, usuario final, squad_member).

### 5.3 Proposito
KB "viva": articulos reutilizables (how_to/runbook/known_error/faq/policy) alimentados por cierres de
casos y captura manual, con metricas de uso (vistas, deflections, escalaciones), feedback util/no-util
y salud del articulo. El **curador** gestiona; el **usuario final** descubre.

### 5.4 Roles y permisos
- Ruta `knowledge.read`.
- `isCurator = isAdmin || perms.includes("knowledge.manage")` -> vista de gestion `KbBrowser`; si no, vista de descubrimiento `UserKnowledge`.
- Feedback: `knowledge.feedback`.

### 5.5 Pantalla
- Curador — `components/knowledge/kb-browser.tsx`: KPIs (articulos activos, % util, deflections, escalaciones, necesitan revision), tabla con numero/titulo/tipo/categoria/vistas/deflections/salud; filtros por tipo/categoria/estado/salud + agrupacion. Badges `ArticleTypeBadge`/`HealthBadge` (`components/knowledge/badges.tsx`). Fila -> `/knowledge/[id]`.
- Usuario final — `components/knowledge/user-knowledge.tsx`: descubrimiento por categoria/tipo reales (sin metricas de operacion, UX-001), busqueda de texto, familias de color por categoria. Solo articulos `active`.

### 5.6 Funcional/tecnico
- `getKb` (`lib/knowledge/queries.ts`): `knowledge_article` no borrados; contadores denormalizados (mantenidos por trigger); deriva `helpful_pct` y `health` (`lib/knowledge/validation.ts`: good>=70, mixed>=40, poor<40, unrated sin votos).
- Metricas derivadas: `helpfulPct`, `deflectionRate`, `articleHealth`.
- RLS por tenant.

### 5.7 Flujos clave
Curador filtra/agrupa y abre articulos; usuario final busca por categoria/tipo.

---

## 6. `/knowledge/[id]` — Articulo

### 6.1 Ruta y parametros
`app/(app)/knowledge/[id]/page.tsx`. Param `id` (uuid). `notFound()` si no existe. **Registra vista** (`recordKbEvent(id,"view","kb")`) al cargar (telemetria).

### 6.2 Modulo/categoria
Sub-ruta de Conocimiento.

### 6.3 Proposito
Lectura del articulo (Markdown renderizado), sus metricas de uso (solo staff), tipo editable/
publicacion (curador), feedback util/no-util (quien tenga `knowledge.feedback`) y enlace al problema
de origen si aplica.

### 6.4 Roles y permisos
- `canManage = isAdmin || knowledge.manage` (cambiar tipo, publicar).
- `canFeedback = isAdmin || knowledge.feedback`.
- `showOps = canManage || perms.includes("incident.read")` — metricas de operacion solo staff; el usuario final (partner) no las ve.

### 6.5 Pantalla
`components/knowledge/article-view.tsx`: cabecera (numero, `ArticleTypeBadge`, `HealthBadge`, estado),
titulo, fila de metricas (vistas/deflections/escalaciones/util/no-util) si `showOps`, contenido via
`AiReport` (render Markdown), selector de tipo + boton publicar (curador), `FeedbackWidget`.
`components/knowledge/feedback-widget.tsx`: voto util/no-util (un voto por usuario) + comentario opcional.

### 6.6 Funcional/tecnico
- `getArticle`: `knowledge_article` + versiones `knowledge_article_version` (toma la de mayor `version_number` para el contenido/tags/summary) + problema origen + mi feedback (`knowledge_feedback` por `user_account_id`).
- Mutaciones (`lib/knowledge/actions.ts`):
  - `submitKbFeedback` — gated `knowledge.feedback`; upsert en `knowledge_feedback` (onConflict article_id,user_account_id); un voto util desde `portal` inserta `knowledge_event` tipo `deflection`.
  - `recordKbEvent` — telemetria (view/deflection/escalation); solo requiere sesion.
  - `setArticleType` — gated `knowledge.manage`; valida tipo (`validateArticleType`).
  - `publishArticle` — gated `knowledge.manage`; `status='active'`.
- Fuentes de feedback validas: `["kb","portal","incident"]`.

### 6.7 Flujos clave
Ver articulo (registra view) -> votar util/no-util -> (curador) cambiar tipo / publicar.

---

## 7. `/knowledge/revision` — Tablero de revision (curador)

### 7.1 Ruta y parametros
`app/(app)/knowledge/revision/page.tsx`. Sin parametros.

### 7.2 Modulo/categoria
Categoria macro **Conocimiento**, item `nav.kbreview` (perm `knowledge.manage`). Gate de ruta
`knowledge.manage`.

### 7.3 Proposito
Cola de borradores pendientes de revisar y publicar: articulos capturados al **cierre** de una entidad
(incident/project/change/major_incident/problem) o creados manualmente, con enlace a su entidad de
origen. Materializa el ciclo de KB living: capturar -> revisar -> publicar/descartar.

### 7.4 Roles y permisos
Ruta y acciones gated `knowledge.manage` (curador). El Operador puede **proponer** un borrador desde su
caso, pero no revisar aqui.

### 7.5 Pantalla
`components/knowledge/kb-review-board.tsx`: hero con conteo, lista de tarjetas de borradores con numero,
titulo, tipo, origen (color + concepto via `ConceptTip`), fecha; acciones **publicar** / **descartar**.
Estado vacio dedicado.

### 7.6 Funcional/tecnico
- `getKbReviewQueue` (`lib/knowledge/queries.ts`): `knowledge_article` con `status='draft'`, resuelve la fuente por las columnas `source_incident_id/source_project_id/source_change_id/source_major_incident_id/source_problem_id` y arma `href` a la entidad.
- Captura al cierre (`lib/knowledge/closure.ts`, `captureClosureKnowledge`): modulo server-only llamado por los actions de cierre; inserta articulo `draft` tipo `known_error` con caso/sintoma/solucion. Idempotente por entidad de origen (chequeo + indice unico). No fatal: el cierre NO se revierte si el KB falla.
- Propuesta manual desde caso (`saveKbArticle`): valida propiedad del caso (`assertActOnIncident`), crea articulo `draft` + version 1 enlazado al incidente.
- Mutaciones: `publishArticle` (`status='active'`), `discardArticle` (soft: `status='archived'`). Ambas gated `knowledge.manage`, revalidan `/knowledge/revision` y `/knowledge`.

### 7.7 Flujos clave
Cierre de caso -> borrador auto-capturado -> curador revisa -> publica (activa) o descarta (archiva).

---

## 8. `/ai-center` — Centro de IA gobernada

### 8.1 Ruta y parametros
`app/(app)/ai-center/page.tsx`. Sin parametros.

### 8.2 Modulo/categoria
Categoria macro **Conocimiento**, item `nav.aicenter` (perm `["incident.read","ai.read"]` any-of).

### 8.3 Proposito
Panel de gobierno de la IA agentic: KPIs de uso, catalogo de agentes disponibles, guardrails de
gobernanza y **bitacora inmutable** de toda interaccion de IA (agente, accion, entidad, modelo, si
requiere revision humana, fecha). Es el punto de auditoria de la capa de IA, no de ejecucion (las
acciones IA se disparan en el detalle del caso).

### 8.4 Roles y permisos
Ruta `incident.read` O `ai.read`. Vista **solo lectura**. Vetada para support_lead/support_agent/
squad_member por `ROLE_ROUTE_DENY`.

### 8.5 Pantalla
`components/ai/ai-center.tsx`: 3 KPIs (total interacciones, agentes activos/total, pendientes de
revision), grid de agentes (`rca_agent`, `score_explainer`, `knowledge_agent`, `business_case_agent`,
`exec_summary_agent`), tarjeta de **guardrails** (texto i18n), y tabla bitacora (agente/accion/entidad/
modelo/revision/fecha). Nota: la constante `AGENTS` del componente lista 5 agentes; en `lib/ai/analysis.ts`
existen ademas `classifier_agent`, `sentiment_agent`, `similar_agent` (clasificacion/sentimiento/
similares) que registran en la misma bitacora — la grilla de agentes del centro no los enumera **(no verificado si es intencional)**.

### 8.6 Funcional/tecnico
- `getAiInteractions` (`lib/ai/queries.ts`): `agent_action` ordenado por fecha (limit 50): agent_name, model_name, action_type, related_entity_type/id, human_review_required, output_json.
- Integracion real Claude (`lib/ai/anthropic.ts`, `callClaude`): fetch a `api.anthropic.com/v1/messages`, `DEFAULT_MODEL="claude-sonnet-5"`. **Sin mock**: si falta `ANTHROPIC_API_KEY` devuelve `ai_not_configured` (la UI degrada, §11 cero mock).
- Acciones IA (gobernanza §11 — la IA SUGIERE, el humano decide; toda accion se registra en `agent_action` con modelo, input/output, confianza):
  - `lib/ai/analysis.ts`: `classifyIncident` (categoria desde catalogo real `incident_category`), `analyzeSentiment`, `findSimilarIncidents`, `refineSimilarAtIntake` (duplicados en intake, sobre borrador). Cada una loguea `agent_action` con `human_review_required: true`. `applyCategory` es la mutacion gated `incident.update` (la IA nunca aplica sola).
  - `lib/ai/suggestions.ts`: `generateRca`, `explainScore` (interpreta la ultima `rule_evaluation`), `generateKbDraft`, `generateBusinessCase`, `generateExecutiveSummary`, `saveRootCause` (guarda decision humana). Registran en `agent_action`.
  - `lib/ai/embeddings.ts`: puente a Edge Function `embed` (gte-small 384d); sin mock (null y degrada).
- Limites de gobierno confirmados en codigo: `logAgentAction` fija `human_review_required` (true en clasificacion/sentimiento/rca/kb/business_case; false en explain_score/exec_summary), `related_entity_type/id` acota la entidad, `model_provider:"anthropic"`, `requested_by_user_id`. La IA no aprueba/borra: no hay mutacion directa de negocio en estos actions salvo `applyCategory`/`saveRootCause`, ambas con decision humana explicita. `tenant_id` en cada insert (no cruza tenants).
- Auditoria: `agent_action` es la bitacora; ademas triggers de ledger a nivel BD.

### 8.7 Flujos clave
Registro se puebla desde el detalle del caso (clasificar/sentimiento/RCA/KB/etc). El centro solo
audita: leer KPIs + bitacora + guardrails.

---

## 9. `/rules` — Motor de reglas y scoring de transformacion

### 9.1 Ruta y parametros
`app/(app)/rules/page.tsx`. Sin parametros. Layout 2 columnas (cola de recomendaciones + config de regla).

### 9.2 Modulo/categoria
Categoria macro **Conocimiento**, item `nav.rules` (perm `rule.read`). Vetada para support_lead/
support_agent/squad_member.

### 9.3 Proposito
Vista del motor de transformacion: la **cola de recomendaciones** de proyectos generadas por el motor
(a partir del score de incidentes) para que el area de negocio (RC) decida, y la **configuracion de la
regla activa** (factores/pesos, umbrales de decision, enlaces de gobierno). Es el corazon del principio
rector: convertir incidentes en oportunidades de evolucion.

### 9.4 Roles y permisos
- Ruta `rule.read`.
- `canDecide = isAdmin || perms.includes("recommendation.decide")` — solo el RC decide; el resto ve la cola en solo lectura.
- Ejecutar el motor (`evaluateIncident`) exige `incident.update` O `triage.manage` (no en esta pantalla; vive en el detalle del caso via `EvaluatePanel`). Evolucion (que solo consume) no puede ejecutarlo.

### 9.5 Pantalla
- `components/rules/recommendations-queue.tsx`: tarjetas de recomendacion con score (color por `scoreColor`), nombre propuesto, enlace al incidente origen, estado. Si `pending`/`deferred` y `canDecide`: inputs de prioridad + razon y botones **Aprobar / Diferir / Rechazar** (`decideRecommendation`). Filtro por estado.
- `components/rules/rule-config.tsx`: nombre/codigo/version de la regla; **factores con pesos** (barras %), validacion visual de que los pesos suman 1 (100%); **umbrales** de decision (`operational`/`problem_review`/`project_review`); enlaces de **gobierno** (`governance_item` por tipo).
- `components/rules/evaluate-panel.tsx` (usado en el detalle del incidente): boton **Evaluar** -> `evaluateIncident`; muestra score, decision, factores; boton **Explicar** (IA `explainScore` -> `AiReport`).

### 9.6 Funcional/tecnico — ciclo de vida de una regla
Modelo (`sql/0019_rule_engine.sql`):
- `rule` (status `record_status` default `draft`; `rule_type` enum, aqui `transformation`).
- `rule_version` (status texto `draft|published|archived`; `expression_json` = parametros de normalizacion, `weights_json` = factor->peso suman 1.0, `thresholds_json` = umbrales de decision; `version_number`).
- `rule_evaluation` (persistencia de cada corrida: input_json/output_json/score/decision/explanation/actor).
- `project_recommendation` (status enum `pending|approved|rejected|deferred|converted`).

**Lectura de config activa** (`getActiveRuleConfig`, `lib/rules/queries.ts`): toma `rule` con
`rule_type='transformation'` y `status='active'`; su `rule_version` con `status='published'` de mayor
`version_number`; enlaces `governance_link` -> `governance_item`.

**Ejecucion del motor** (`evaluateIncident`, `lib/rules/engine.ts`):
1. Autorizacion en capa de aplicacion (`incident.update`/`triage.manage`), antes de leer/mutar.
2. Lee incidente (+ criticidad de CI/servicio), la `rule` activa y su `rule_version` publicada.
3. Calcula 8 factores config-driven: `financial_impact`, `frequency_recurrence` (recurrencia por CI en ventana `expr.frequency_recurrence.windowDays`, default 30), `critical_service` (mapa por criticidad), `partner_impact`, `data_quality`, `security_risk`, `manual_workaround` (de `metadata`), `strategic_alignment` (de metadata/default). Cada uno `clamp(0..100)` y ponderado por `weights_json`.
4. `score = suma(raw*weight)`; **decision por umbrales** `thresholds_json`: `operational` (<=39.99), `problem_review` (<=69.99), `project_review` (<=84.99), sino `auto_project`.
5. Persiste `rule_evaluation` (input/output/score/decision/explanation, `evaluation_context='manual_evaluate'`, actor usuario) — **auditado en ledger** (trigger `audit_row_change` sobre `rule_evaluation`).
6. Actualiza `incident.transformation_score/candidate/decision`.
7. Si decision es `project_review`/`auto_project` y no hay recomendacion pending/deferred, crea `project_recommendation` (`status='pending'`, `recommended_project_type='evolution'`).
- `evaluateOpenIncidents(max=100)`: corre el motor real en lote sobre casos abiertos sin puntuar (`transformation_score=0`), sin mock (§11), acotado por `max`.
- `getIncidentEvaluation` (`lib/rules/actions.ts`): lectura READ-ONLY de la ultima evaluacion (no re-ejecuta el motor, que tendria efectos).

**Decision de negocio** (`decideRecommendation`, `lib/rules/actions.ts`): gated `recommendation.decide`.
`approved` exige prioridad>=1; actualiza `project_recommendation` (status/prioridad/razon/reviewed_by/at).
Al aprobar: mueve el incidente a `status='in_evolution'` + `transformation_decision='approved_to_evolution'`
+ `transformation_candidate`, agrega comentario visible al cliente (**la mesa mantiene el tracking**,
client-centric §0) y notifica via RPC `notify_role` al `product_owner` (campanita) para convertir en
proyecto. Auditado en ledger.

Nota de ciclo de vida: la config (pesos/umbrales) se muestra **solo lectura** en `/rules`; una `rule_version`
es inmutable una vez `published` y su historico queda auditado. **No verificado en codigo un flujo de UI
para crear/simular/publicar una nueva version de regla** (borrador->simular->publicar): la publicacion de
version parece hacerse por migracion/seed (`sql/0020_seed_rule_governance.sql`), no por pantalla. El
diseno de tablas si soporta versionado (draft/published/archived) y simulacion (expression_json).

### 9.7 Flujos clave
1. Caso -> `EvaluatePanel` (`evaluateIncident`) -> score+decision -> si candidato crea `project_recommendation`.
2. `/rules` -> RC ve la cola -> **Aprobar** (con prioridad) -> incidente a `in_evolution` + notifica al PO -> se convertira en proyecto de Evolucion (la mesa conserva el hilo con el cliente).

---

## 10. `/workflows` — Motor de workflows (instancias + definiciones)

### 10.1 Ruta y parametros
`app/(app)/workflows/page.tsx`. Sin parametros. Dos pestanas.

### 10.2 Modulo/categoria
Categoria macro **Conocimiento**, item `nav.workflows` (perm `workflow.read`).

### 10.3 Proposito
Motor de procesos ejecutables (audit-grade, PL/pgSQL): ejecuta **instancias** de workflow ligadas a
entidades (incident/problem/change/request/project/generic) y permite **disenar definiciones** (nodos +
aristas con guardas). Da tracking de los pasos y su avance.

### 10.4 Roles y permisos
- Ruta `workflow.read`.
- `canManage = workflow.manage` (disenar/publicar definiciones).
- Ejecutar (iniciar/avanzar/cancelar) exige `workflow.run` (en el detalle de instancia).

### 10.5 Pantalla
`components/workflows/workflows.tsx`: pestanas **Instancias** (`instances-tab.tsx`) y **Definiciones**
(`definitions-tab.tsx`), con badge de instancias `running` y conteo de definiciones.
- `instances-tab.tsx`: tabla numero/titulo/definicion/progreso (pasos completados/total + activos)/estado, con filtros por estado/entidad/definicion. Fila -> `/workflows/[id]`.
- `definitions-tab.tsx`: tabla de definiciones (codigo/nombre/entidad/version/nodos/instancias/estado), filtros; boton **crear definicion** (si `canManage`) -> `createDefinition` -> redirige a `/workflows/definitions/[id]`. Entidades: `generic/incident/problem/change/request/project`.

### 10.6 Funcional/tecnico
- Queries (`lib/workflows/queries.ts`): `listInstances`, `listDefinitions`, `getInstance`, `getInstanceSteps`, `getDefinition`, `getDefinitionGraph` (nodos+aristas), `getWorkflowsForIncident`/`getWorkflowsForProject` (tracking en detalle de caso/proyecto), `getActiveDefinitions`, `getWorkflowFormOptions` (roles reales `role` + teams de `incident_category.default_team`).
- Motor RPC en PL/pgSQL (`sql/0044_workflow_engine.sql`): `start_workflow(p_definition_id, p_entity_type, p_entity_id, p_title)`, `advance_workflow_step(p_step_id, p_outcome, p_note)`. Audit-grade (triggers `audit_row_change` sobre definition/node/edge/instance/step).
- Logica pura de grafo (`lib/workflows/graph.ts`): `nextNodeIds` (aristas con guarda null o = outcome), `allowedOutcomes` (approval -> approved/rejected; task/automated -> done). Espeja el ruteo del motor SQL.
- RLS por tenant.

### 10.7 Flujos clave
Ver instancias en curso / crear definicion. El diseno y la ejecucion viven en las sub-rutas.

---

## 11. `/workflows/[id]` — Detalle de instancia

### 11.1 Ruta y parametros
`app/(app)/workflows/[id]/page.tsx`. Param `id` (uuid de instancia). `notFound()` si no existe.

### 11.2 Modulo/categoria
Sub-ruta de Workflows.

### 11.3 Proposito
Ejecutar y auditar una instancia: ver sus pasos (estado/outcome/nota/tiempos), avanzar el paso activo
segun outcomes permitidos, cancelar la instancia y ver su **traza de ledger** (hash-chain).

### 11.4 Roles y permisos
Ruta hereda `workflow.read`. `canRun = workflow.run` habilita avanzar/cancelar.

### 11.5 Pantalla
`components/workflows/instance-detail.tsx`: cabecera (numero, titulo, estado, definicion), timeline de
pasos (`workflow_step` con `NodeIcon`/`STEP_COLOR`), controles de avance (outcome + nota) si `canRun`,
boton cancelar, y panel de **ledger** (block_height, action, current_hash, timestamp) — evidencia
audit-grade.

### 11.6 Funcional/tecnico
- `getInstance`, `getInstanceSteps` (ordenados por `node.sort_order`), y `getLedgerForEntity` (`lib/incidents/queries.ts`) para la traza inmutable de la instancia.
- Mutaciones (`lib/workflows/actions.ts`, gated `workflow.run`): `advanceStep` -> RPC `advance_workflow_step`; `cancelInstance` -> update `workflow_instance` a `cancelled` (solo si `running`).
- Outcomes validos por tipo de nodo desde `allowedOutcomes`.

### 11.7 Flujos clave
Avanzar paso activo (outcome routea al/los siguiente/s nodos por guarda) hasta un nodo `end`; o cancelar.
Cada transicion queda en el ledger.

---

## 12. `/workflows/definitions/[id]` — Editor de definicion

### 12.1 Ruta y parametros
`app/(app)/workflows/definitions/[id]/page.tsx`. Param `id` (uuid de definicion). `notFound()` si no existe.

### 12.2 Modulo/categoria
Sub-ruta de Workflows (diseno).

### 12.3 Proposito
Disenar el grafo de una definicion (solo en estado `draft`): nodos (start/task/approval/automated/end)
con asignacion por rol/equipo y SLA, y aristas con guardas; validar y **publicar** (draft->active). Es el
ciclo de vida de la definicion.

### 12.4 Roles y permisos
Ruta `workflow.read`. `canManage = workflow.manage`. Edicion solo si `canManage && status==='draft'`
(`editable`).

### 12.5 Pantalla
`components/workflows/definition-detail.tsx`: cabecera (codigo/nombre/entidad/estado `DefStatusBadge`),
alta/baja de **nodos** (tipo, rol asignado, SLA) y **aristas** (from/to, guarda ∈ `""/approved/rejected/done`,
label), boton **publicar** (muestra `issues` de validacion si falla), y cambiar estado (draft/inactive).

### 12.6 Funcional/tecnico
- `getDefinitionGraph` + `getWorkflowFormOptions` (roles/teams reales).
- Mutaciones (`lib/workflows/actions.ts`, gated `workflow.manage`): `createDefinition`, `addNode`/`deleteNode`, `addEdge`/`deleteEdge` (todas exigen `assertDraft` = definicion en `draft`), `publishDefinition`, `setDefinitionStatus`.
- **Validacion antes de publicar** (`lib/workflows/validation.ts`, `validateDefinition`): exactamente 1 `start`, al menos 1 `end`, aristas con nodos existentes, todo nodo no-`end` con salida, nodos `approval` con ramas `approved` y `rejected`. Espeja las precondiciones del motor SQL. `publishDefinition` bloquea con `issues` si falla.
- Dedup por codigo (error 23505 -> `ErrorCode.DUPLICATE`).

### 12.7 Flujos clave
Crear definicion (draft) -> agregar nodos/aristas -> **publicar** (valida grafo) -> `active` (ya no
editable, se puede instanciar). Ciclo de vida inmutable/versionado por `version_no`.

---

## 13. `/processes` — Gobierno de datos (procesos + matriz)

### 13.1 Ruta y parametros
`app/(app)/processes/page.tsx`. Sin parametros. Dos pestanas.
> Implementacion en `lib/process/` y `components/process/` (singular), no `processes`.

### 13.2 Modulo/categoria
Categoria macro **Administracion**, item `nav.processes` (perm `process.read`, `absorbedInHub` — tambien
vive en `/catalog`).

### 13.3 Proposito
Gobierno de datos maestros de procesos: jerarquia de procesos (macro/nivel), su cobertura de sistemas
(CIs vinculados con rol/criticidad) y la **matriz producto->canal** (disponibilidad). Detecta procesos
sin cobertura de sistemas.

### 13.4 Roles y permisos
Ruta `process.read`. `canManage = process.manage` (vincular/desvincular sistema y producto-canal).

### 13.5 Pantalla
`components/process/process-governance.tsx`: pestanas **Procesos** (`process-list.tsx`: stats total/macro/
sin-sistemas, tabla codigo/nombre/nivel/BU/#sistemas/cobertura, fila -> `/processes/[id]`) y **Matriz**
(`product-channel-matrix.tsx`: grilla producto x canal con disponibilidad y densidad).

### 13.6 Funcional/tecnico
- `listProcesses` (`lib/process/queries.ts`): `process` no borrados + count `process_system`; deriva `coverage` (`coverageLabel`: none/single/covered).
- `getProductChannelMatrix`: `product` x `channel` no borrados + links `product_channel` (availability).
- Mutaciones (`lib/process/actions.ts`, gated `process.manage`): `linkProcessSystem`/`unlinkProcessSystem`, `linkProductChannel`/`unlinkProductChannel`. Dedup 23505 -> DUPLICATE.
- Validacion (`lib/process/validation.ts`): `validateProcessSystem` (role ∈ primary/secondary/integration/manual, criticality ∈ critical/high/medium/low), `validateProductChannel` (availability ∈ active/pilot/retired). `matrixDensity`, `coverageLabel`.

### 13.7 Flujos clave
Explorar procesos y su cobertura; gestionar matriz producto-canal.

---

## 14. `/processes/[id]` — Ficha de proceso

### 14.1 Ruta y parametros
`app/(app)/processes/[id]/page.tsx`. Param `id` (uuid). `notFound()` si no existe.

### 14.2 Modulo/categoria
Sub-ruta de Procesos.

### 14.3 Proposito
Ficha del proceso: objetivo, nivel, BU/padre, subprocesos (hijos) y sistemas vinculados (CIs con rol y
criticidad). Permite vincular/desvincular sistemas (gobierno de cobertura).

### 14.4 Roles y permisos
Ruta `process.read`. `canManage = process.manage` habilita el editor (y carga `listSystems` solo si canManage).

### 14.5 Pantalla
`components/process/process-card.tsx`: cabecera (codigo/nombre/nivel/BU/padre), objetivo, lista de
subprocesos (enlaces), tabla de sistemas vinculados (CI/tipo/rol/criticidad con color), y editor de
vinculacion (select CI disponible + rol + criticidad) si `canManage`.

### 14.6 Funcional/tecnico
- `getProcess`: `process` + owner(BU) + parent + hijos (`parent_process_id`) + `process_system` (ci:ci_id id/name/ci_type). `listSystems`: `configuration_item` no borrados.
- Mutaciones: `linkProcessSystem`/`unlinkProcessSystem` (gated `process.manage`); el select excluye CIs ya vinculados.

### 14.7 Flujos clave
Vincular un sistema (CI) al proceso con rol/criticidad; ver jerarquia y cobertura.

---

## Notas de integridad (§10/§11 CLAUDE.md) observadas en codigo

- **Cero hardcode de datos maestros**: selects consumen catalogos reales (skill, delivery_area, process, business_unit, product, channel, configuration_item, service, incident_category, role). Constantes en `validation.ts` espejan enums del esquema (excepcion permitida §11).
- **Soft delete**: `team_member` (active/inactive), `discardArticle` (archived), delivery_area/process/product/channel filtran `neq status deleted`.
- **Duplicados en capas**: email de miembro (servicio + `neq deleted`), skill/expertise (chequeo + 23505), workflow code, process_system/product_channel (23505).
- **Validacion multi-capa**: `validation.ts` puro reutilizado en UI/action/tests (`*.test.ts` presentes en talent/knowledge/process/workflows/ai).
- **Auditoria**: mutaciones de negocio quedan en ledger via triggers BD; acciones IA en `agent_action`; workflow y rule con traza inmutable.


---

# Clúster E — Administración + Transversales

# CLUSTER E — Administracion, Datos Maestros, Ledger/CMDB, Portales de Rol y Temas Transversales

> Documentacion tecnica del manual de Credix Nexus. Todo el contenido sale del **codigo real** del
> repositorio (rutas citadas). Los puntos que no pudieron verificarse contra el codigo se marcan
> explicitamente con **(no verificado)**. i18n: todo copy visible se resuelve por clave contra
> `lib/i18n/dictionaries.ts` (ES por defecto / EN obligatorio); en esta doc las claves aparecen entre
> comillas (p.ej. `"md.title"`).

Stack (verificado en `CLAUDE.md` §0.1 y en el codigo): monolito modular **Next.js 16 App Router +
React 19 + TypeScript** sobre **Supabase** (Postgres 17, Auth, RLS, Storage). Rutas del cluster bajo
`app/(app)/`; landing y bootstrap en `app/page.tsx` y `app/start/`.

Patron comun de TODAS las paginas del cluster (Server Components):
1. `getContext()` (`lib/auth/context.ts`) resuelve `{ supabase, user, accountId, tenantId, partyId, name }`
   reutilizando la sesion cacheada por request (`lib/auth/session.ts`).
2. La pagina carga datos server-side (queries a Supabase / RPC) y renderiza un componente cliente.
3. El **guard de ruta** (permiso + denylist de persona) se aplica una sola vez en el layout
   `app/(app)/layout.tsx` — las paginas no repiten el candado (salvo `sso-domains`, que revalida admin).

---

## INDICE DE PANTALLAS

| # | Ruta | Modulo (categoria macro) | Persona/Rol principal |
|---|------|--------------------------|-----------------------|
| E1 | `/admin` | Administracion | admin (`user.manage`) |
| E2 | `/admin/sso-domains` | Administracion | admin (system/tenant_admin) |
| E3 | `/catalog` | Administracion (Datos Maestros - hub) | `masterdata.manage` |
| E4 | `/catalog/[catalog]` | Administracion (CRUD generico - lista) | `masterdata.manage` |
| E5 | `/catalog/[catalog]/new` | Administracion (alta) | `masterdata.manage` |
| E6 | `/catalog/[catalog]/[id]/edit` | Administracion (edicion) | `masterdata.manage` |
| E7 | `/cmdb` | Administracion | `cmdb.read` |
| E8 | `/ledger` | Administracion | `audit.read` |
| E9 | `/mi-dia` | Mi Dia (Operador) | `support_agent` |
| E10 | `/mis-casos` | Mis Casos (Operador) | `support_agent` |
| E11 | `/mi-desempeno` | Yo (Operador) | `support_agent` |
| E12 | `/notificaciones` | Yo (Operador) | `support_agent` |
| E13 | `/mi-trabajo` | Mi trabajo (Miembro de Squad) | `squad_member` |
| E14 | `/mi-squad` | Mis squads (Miembro de Squad) | `squad_member` |
| E15 | `/mis-iniciativas` | Iniciativas (Miembro de Squad) | `squad_member` |
| E16 | `/mi-perfil` | Perfil (Miembro de Squad) | `squad_member` |
| E17 | `/` (landing) + `/start` (router de home) | Publico / bootstrap | todos |
| E18 | `/unauthorized` | Sistema | todos |

## INDICE DE TEMAS TRANSVERSALES (columna vertebral)

- T1. Modelo de roles y permisos (RBAC)
- T2. Navegacion (8 categorias macro + overlays por persona)
- T3. Multi-tenant + RLS
- T4. Ledger / audit-grade (hash-chaining)
- T5. i18n ES/EN
- T6. Design system (temas Nexus/Claro, marca)
- T7. Stack y arquitectura (estructura de carpetas)

---

# PANTALLAS

## E1 — `/admin` (Hub de Administracion)

**1. Ruta y parametros.** `app/(app)/admin/page.tsx`. Sin parametros.

**2. Modulo/categoria.** Categoria macro **Administracion** (`nav.macro.administracion`), item `nav.admin`
(`lib/nav/navigation.ts`). Gateada por `user.manage`.

**3. Proposito.** Panel central de administracion de usuarios del tenant: KPIs de la instalacion,
listado de usuarios con sus roles y estado, y edicion de roles/estado por usuario.

**4. Roles y permisos.** Requiere `user.manage` (guard de ruta `ROUTE_PERMISSIONS` en `lib/nav/access.ts`,
prefijo `/admin`). Los admin (`system_admin`/`tenant_admin`) lo tienen; el guard tambien deja pasar a
cualquier rol con `user.manage`. Las RPC subyacentes son `SECURITY DEFINER` y **revalidan** `user.manage`
+ aislan por tenant (comentario en `lib/admin/queries.ts`).

**5. Pantalla.** Componente `components/admin/admin-hub.tsx` (`AdminHub`).
- 5 tarjetas KPI: usuarios activos/total, roles, incidentes, proyectos, eventos de auditoria
  (claves `"adm.kpi.*"`).
- Tabla de usuarios (`UserRow`): nombre, email, estado, chips de roles. Acciones por fila:
  **editar roles** (toggles multi-rol -> `setUserRoles`), **activar/desactivar** (`setUserStatus`).
  La fila del propio usuario (`isSelf`, comparando `selfAccountId = ctx.accountId`) protege contra
  auto-modificacion (el backend responde `self_forbidden` -> mensaje `ERR_SELF`).
- Mensajes ok/err por operacion traducidos por `"err.*"`.

**6. Funcional/tecnico.**
- Carga (`lib/admin/queries.ts`): `admin_overview()`, `admin_list_users()`, `admin_list_roles()`
  (RPC definidas en `sql/0071_admin_functions.sql`).
- Mutaciones (`lib/admin/actions.ts`, server actions): `admin_set_user_roles(p_account, p_roles)` y
  `admin_set_user_status(p_account, p_active)`. Guard de app: `hasPermission(user.manage)` antes de la RPC;
  `mapErr` traduce `self_forbidden`->`ERR_SELF`, `forbidden`->`ERR_PERMISSION`, `not_found`->
  `ERR_INVALID_REFERENCE`. `revalidatePath("/admin")` tras exito.
- Ledger: la escritura de roles/estado toca `user_account` / `user_role`, tablas con trigger de auditoria
  (`user_account` tiene `trg_audit_user`, `sql/0003_ledger.sql`; el fix de auditoria de `user_role` esta
  en `sql/0132_fix_user_role_audit.sql`).

**7. Flujos clave.** Admin abre `/admin` -> edita roles de un usuario -> `setUserRoles` -> RPC valida y
aplica -> ledger registra la mutacion -> `router.refresh()`. Auto-edicion bloqueada.

---

## E2 — `/admin/sso-domains` (Dominios SSO permitidos / JIT provisioning)

**1. Ruta y parametros.** `app/(app)/admin/sso-domains/page.tsx`. Sin parametros.

**2. Modulo/categoria.** Administracion, item `nav.sso_domains` (perm de nav `user.manage`).

**3. Proposito.** Whitelist de dominios de correo autorizados para el login federado (Entra ID / SSO) con
**JIT provisioning**: cuando entra un usuario de un dominio permitido, se le crea la cuenta con el rol por
defecto configurado. Config **sensible de seguridad** (controla quien puede entrar).

**4. Roles y permisos.** **Doble candado**: guard de ruta `user.manage` (layout) + revalidacion explicita
en la propia pagina: `getAccessControl()` y `if (!access.isAdmin) redirect("/unauthorized")` (solo
`system_admin`/`tenant_admin`). Las server actions vuelven a exigir admin (`requireAdmin` en
`lib/auth/sso-domains.ts`).

**5. Pantalla.** Componente `components/admin/sso-domains-admin.tsx` (`SsoDomainsAdmin`), recibe `domains`
y `roles`. CRUD de dominios: alta/edicion (dominio + rol por defecto + notas), activar/desactivar
(soft delete). Muestra el **nombre descriptivo del rol** (no el UUID), via join `role:default_role_id(code,name)`.

**6. Funcional/tecnico.** `lib/auth/sso-domains.ts`:
- `listSsoDomains()`: `select` sobre `sso_allowed_domain` con join al `role`; RLS por tenant aplica.
- `listAssignableRoles()`: roles globales (`tenant_id is null`) + del tenant, `status=active`.
- `upsertSsoDomain(id, {domain, default_role_id, notes})`: valida formato de dominio con
  `DOMAIN_RE` (espeja el `CHECK chk_sso_domain_format`), exige rol existente (global o del tenant),
  control de duplicado (dominio unico global) con mensaje `"sso.admin.err.duplicate"`. Inserta con
  `tenant_id = ctx.tenantId`. Errores i18n `"sso.admin.err.*"`.
- `setSsoDomainStatus(id, active)`: soft delete (`status` active/inactive), nunca borrado fisico.
- Tabla `sso_allowed_domain` definida en `sql/0130_sso_allowed_domain.sql` con **RLS por tenant**
  (`sso_domain_isolation`) y auditoria al ledger por trigger (comentario en el lib). El enganche JIT del
  usuario nuevo esta en `sql/0131_handle_new_user_jit.sql` y `sql/0121_federated_login_linking.sql` (no verificado en detalle).

**7. Flujos clave.** Admin agrega dominio `credix.com` con rol por defecto `partner_user` -> usuario de
ese dominio entra por Entra ID -> trigger `handle_new_user` crea cuenta con ese rol. Referencia de plan:
`docs/auth/SSO_ACTIVE_DIRECTORY_PLAN.md` (citada en el lib).

---

## E3 — `/catalog` (Hub de DATOS MAESTROS)

**1. Ruta y parametros.** `app/(app)/catalog/page.tsx`. Sin parametros.

**2. Modulo/categoria.** Administracion, item `nav.catalog` (perm `masterdata.manage`). El hub es la
**unica entrada** a los datos maestros; catalogos con explorador propio se enlazan a el (ver `explorerHref`).

**3. Proposito.** Indice de todos los catalogos administrables (datos maestros) agrupados por seccion,
con el conteo de registros activos por catalogo. Es la puerta al **CRUD generico por catalogo**.

**4. Roles y permisos.** Ruta gateada por `masterdata.manage`. Este permiso NO se otorga en el seed base
`sql/0012`; su definicion y asignacion de rol viven en el snapshot de seed
(`sql/seed/snapshot_anon/permission.csv`, id `d1da39e4-...`, "Gestionar catalogos de datos maestros") +
migraciones de ampliacion (ver T1). En la practica lo tienen admins y el rol de administracion de datos maestros.

**5. Pantalla.** Componente `components/masterdata/md-index.tsx` (`MdIndex`).
- Titulo `"md.title"` / subtitulo `"md.subtitle"`.
- Secciones en orden fijo (`GROUP_ORDER`): `"md.grp.org"`, `"md.grp.service"`, `"md.grp.tech"`,
  `"md.grp.governance"`.
- Grid de tarjetas: cada catalogo muestra su titulo y el conteo (`counts[key]`) en mono con `--accent-2`.
- El destino de la tarjeta es `explorerHref ?? /catalog/{key}` (p.ej. `squads`->`/squads`,
  `processes`->`/processes`, `systems`->CRUD generico; ver registry).

**6. Funcional/tecnico.**
- La lista de catalogos es **metadata de esquema** (whitelist), no dato de negocio, y vive en
  `lib/masterdata/registry.ts` (constante `CATALOGS`). El comentario del archivo aclara que los VALORES
  siempre vienen de la BD (no viola la regla de no-hardcode §11); los `options` de enum ESPEJAN el
  CHECK/enum real del esquema.
- El conteo se computa en la pagina: por cada `CATALOGS[i]` hace
  `supabase.from(table).select("*", {count:"exact", head:true}).eq("status","active")`.

**Catalogos registrados (12)** — `key -> table (grupo)`:

| key | tabla | grupo | campos (tipo) |
|-----|-------|-------|---------------|
| business-units | `business_unit` | org | code, name |
| products | `product` | service | code, name, product_family, business_unit_id(fk) |
| channels | `channel` | service | code, name, channel_type(enum 16 valores) |
| skills | `skill` | org | code, name, category |
| incident-categories | `incident_category` | service | code, name, default_team, default_priority(enum), requires_rca(bool), requires_kb(bool) |
| squads | `squad` | org | code, name, capacity_points(num 0-100), business_unit_id(fk) · explorerHref `/squads` |
| processes | `process` | governance | code, name, process_level(enum macro/process/micro), business_unit_id(fk), parent_process_id(fk) · explorerHref `/processes` |
| systems | `configuration_item` | tech | code, name, ci_type, criticality(enum crit/high/med/low), service_id(fk), vendor_id(fk) |
| case-types | `case_type` | service | code, name, category, domain |
| macros | `macro` | service | code, name, category, body(textarea) |
| governance-items | `governance_item` | governance | item_type(enum policy/norm/procedure/process/control), code, name, description |

**7. Flujos clave.** Admin abre `/catalog` -> ve conteos por catalogo -> entra a un catalogo -> CRUD.

---

## E4 — `/catalog/[catalog]` (Lista del catalogo - CRUD generico)

**1. Ruta y parametros.** `app/(app)/catalog/[catalog]/page.tsx`. Parametro dinamico `catalog` (= `key`
del registry). Si no existe en `CATALOGS` -> `notFound()`.

**2. Modulo/categoria.** Administracion (Datos Maestros). Subruta de `/catalog`.

**3. Proposito.** Listado, busqueda, filtrado, agrupacion y gestion (activar/desactivar, ir a editar/crear)
de los registros de UN catalogo generico.

**4. Roles y permisos.** Ver la lista requiere entrar a `/catalog` (`masterdata.manage`). El flag
`canManage = hasPermission("masterdata.manage")` habilita/oculta las acciones de escritura (editar, crear,
activar/desactivar). Sin ese permiso la lista es de solo lectura.

**5. Pantalla.** Componente `components/masterdata/md-list.tsx` (`MdList`).
- Breadcrumb: `BackButton` a `/catalog` + titulo del catalogo.
- Buscador (por `code`/`name`, client-side) + toggle "Mostrar inactivos" (`"md.showinactive"`).
- Boton **Nuevo** (`"md.new"`) -> `/catalog/{key}/new` (solo si `canManage`).
- `FilterBar` + `GroupBar` (de `components/common/filters`) sobre las columnas extra (`listCols`);
  cada valor de columna es un `Drill` clickeable que fija el filtro.
- Tabla: columnas code (mono, acento), name (bold), columnas extra (`listCols`, con `disp()` que resuelve
  bool->Si, fk->nombre desde `fkOptions`, resto->texto), estado (chip), acciones.
- Acciones por fila (si `canManage`): editar (`/catalog/{key}/{id}/edit`) y activar/desactivar con
  **confirmacion** (`confirm(t("md.confirm_deactivate"))`).
- Estados: vacio (`EmptyState "md.empty"`), agrupado (`GroupHeader`).

**6. Funcional/tecnico.**
- Carga (`lib/masterdata/queries.ts`): `listRecords(supabase, catalog, {includeInactive:true})` selecciona
  `id, code, name, status, ...listCols`, orden por `name`, `limit 500`, busqueda `.or(code.ilike,name.ilike)`.
- `getCatalogFkOptions(supabase, catalog)`: por cada campo `fk`, trae `id, name` de la `fkTable` con
  `status=active` (opciones desde la BD, no hardcode).
- Mutacion de estado: `setRecordStatus(catalogKey, id, "active"|"inactive"|"archived")`
  (`lib/masterdata/actions.ts`), server action que exige `masterdata.manage`, hace UPDATE de `status`
  (soft delete, nunca DELETE) y `revalidatePath`.
- RLS: todas las tablas de catalogo llevan `tenant_id` y policy por tenant; los registros ya vienen
  filtrados por RLS.
- Ledger: cada catalogo es un maestro con trigger `audit_row_change` (T4) -> alta/edicion/baja quedan en
  el ledger. (La lista exacta de tablas con trigger adjunto no se auditó campo a campo aqui — **(no verificado)**
  que TODOS los 12 catalogos tengan el trigger adjunto; el mecanismo generico existe en `sql/0003_ledger.sql`).

**7. Flujos clave.** Filtrar/buscar -> editar o desactivar (con confirmacion) -> refresco. Duplicados y
validaciones se manejan en el alta/edicion (E5/E6).

---

## E5 — `/catalog/[catalog]/new` (Alta de registro)

**1. Ruta y parametros.** `app/(app)/catalog/[catalog]/new/page.tsx`. Parametro `catalog`.

**2. Modulo/categoria.** Administracion (Datos Maestros).

**3. Proposito.** Formulario de creacion de un registro del catalogo.

**4. Roles y permisos.** La pagina re-verifica: si NO `hasPermission("masterdata.manage")` -> `redirect(/catalog/{key})`.

**5. Pantalla.** Componente `components/masterdata/md-form.tsx` (`MdForm`, `mode="create"`).
- Renderiza un `FieldInput` por cada campo del registry, segun su `type`: text/code/number (input),
  textarea, enum (select con `options`), fk (select con `fkOptions` — muestra `name`), bool (checkbox).
- Requeridos marcados con `*`. Botones Cancelar / Crear (`"md.create"`).
- Validacion cliente (`validate()`): requeridos, formato de `code` (`CODE_RE = /^[A-Z0-9_\-]{2,80}$/`),
  min length, rango numerico. Errores por campo traducidos por `"err.*"` (ERR_REQUIRED_FIELD,
  ERR_INVALID_FORMAT, ERR_MIN_LENGTH).

**6. Funcional/tecnico.** Envio -> `upsertRecord(catalogKey, null, values)` (`lib/masterdata/actions.ts`):
- Guard `masterdata.manage` + `ctx.tenantId`.
- **Validacion backend por campo** (`validateField`): mismos checks + enum contra `options`
  (`ERR_INVALID_REFERENCE`).
- **Integridad referencial**: cada FK debe existir y pertenecer al tenant
  (`.eq("id", v).eq("tenant_id", ctx.tenantId)`), si no -> `ERR_INVALID_REFERENCE` en ese campo.
- **Control de duplicados por `code`**: query por `tenant_id + code` (excluyendo el propio id) ->
  `ERR_DUPLICATE` en campo `code`. (Validacion en 3 capas: BD unique/constraint, servicio, formulario — §10.4.)
- INSERT con `...values, tenant_id: ctx.tenantId`; `revalidatePath`. Ledger via trigger.

**7. Flujos clave.** Crear -> validaciones cliente+servidor -> duplicado rechazado con mensaje -> exito ->
`router.push(/catalog/{key})`.

---

## E6 — `/catalog/[catalog]/[id]/edit` (Edicion de registro)

**1. Ruta y parametros.** `app/(app)/catalog/[catalog]/[id]/edit/page.tsx`. Parametros `catalog`, `id`.

**2. Modulo/categoria.** Administracion (Datos Maestros).

**3. Proposito.** Formulario de edicion de un registro existente.

**4. Roles y permisos.** Igual que E5: re-verifica `masterdata.manage`, si no redirige. Si el registro no
existe (`getRecord` -> null) -> `notFound()`.

**5. Pantalla.** `MdForm` con `mode="edit"`, `id`, `initial=record`. Boton Guardar (`"md.save"`). Mismo
motor de validacion y campos que E5.

**6. Funcional/tecnico.** Carga: `getRecord(supabase, catalog, id)` (`select * where id`). Envio ->
`upsertRecord(catalogKey, id, values)`: mismo pipeline (validacion, FK, duplicado excluyendo el propio id)
pero rama UPDATE por `id`. Ledger via trigger (payload before/after).

**7. Flujos clave.** Editar campos -> guardar -> validaciones -> exito -> vuelve a la lista.

---

## E7 — `/cmdb` (CMDB - Elementos de configuracion)

**1. Ruta y parametros.** `app/(app)/cmdb/page.tsx`. `searchParams.type` opcional (filtra por
`application` | `system` al entrar).

**2. Modulo/categoria.** Administracion, item `nav.cmdb` (perm `cmdb.read`).

**3. Proposito.** Inventario de **Configuration Items** (aplicaciones y sistemas) de Credix: los sistemas
legacy (SAC, Prisma, MiCredix, Flip, Autocartera) viven aqui como CI, NUNCA como tenants (invariante §11).
El alta/edicion de CI se hace por el catalogo generico (`systems` -> tabla `configuration_item`); `/cmdb` es
el **explorador** de solo consulta.

**4. Roles y permisos.** Ruta gateada por `cmdb.read`.

**5. Pantalla.** Componente `components/cmdb/cmdb-list.tsx` (`CmdbList`).
- `BackButton` a `/dashboard`.
- `FilterBar` + `GroupBar` sobre 3 dimensiones: tipo (`ci_type`), estado (`status`), proveedor
  (`vendor.name`). Filtro inicial por `initialType` si vino en la URL.
- Tabla: nombre (bold), tipo (chip; application con `--accent-2`, otros `--st-info`), proveedor (drill),
  estado (chip). Estado vacio `"cmdb.empty"`. Labels via `"cmdb.type.*"` y `"sla.st.*"`.

**6. Funcional/tecnico.** `lib/cmdb/queries.ts` -> `listConfigItems`: `select id, name, ci_type, status,
vendor:vendor_id(name)` de `configuration_item`, `neq status deleted`, orden por `name`. Tabla
`configuration_item` definida en `sql/0007_cmdb.sql`; seed de aplicaciones/sistemas en `sql/0012`. RLS por
tenant. El dashboard usa un conteo de CMDB (`sql/0123_dashboard_counts_cmdb.sql`).

**7. Flujos clave.** Consultar/filtrar el inventario. Rutas relacionadas: `/dependencies`
(`service_dependency`, perm `cmdb.read`) y `/service-catalog`.

---

## E8 — `/ledger` (Ledger inmutable - historial audit-grade)

**1. Ruta y parametros.** `app/(app)/ledger/page.tsx`. Sin parametros. Requiere `ctx.tenantId`.

**2. Modulo/categoria.** Administracion, item `nav.ledger` (perm `audit.read`).

**3. Proposito.** Historial inmutable de TODA mutacion de negocio relevante, con **verificacion
criptografica** de la integridad de la cadena (hash-chaining por tenant). Es el corazon audit-grade
(principio §11: "ninguna mutacion relevante existe sin su `immutable_audit_event`").

**4. Roles y permisos.** Ruta gateada por `audit.read` (lo tienen `grc_officer`, `auditor` en el seed;
admins por bypass). En `role-ux.ts` el rol `auditor` tiene `home:/ledger` y accion primaria
`verifyLedger`.

**5. Pantalla.** Componente `components/ledger/ledger-view.tsx` (`LedgerView`).
- 3 KPIs: total de bloques, verificados, rotos (`"led.kpi.blocks|verified|broken"`). Bloques rotos en
  `--st-critical`.
- Banner de integridad: verde `"led.integrity_ok"` si `broken==0`, rojo `"led.integrity_broken"` si hay
  bloques rotos.
- Filtros por `entity_type` y `actor_type` (derivados de los eventos cargados).
- Boton **Exportar CSV** (`exportCsv`, client-side; header block_height/timestamp/actor/action/entity/hash/verified).
- Tabla: bloque (#height, mono), timestamp (locale), actor (drill), accion, entity_type (drill),
  hash (primeros 12 chars, `--accent-2`), verificado (check/x). El check usa `--st-verified`.

**6. Funcional/tecnico.** `lib/ledger/queries.ts` -> `getLedger(supabase, tenantId, limit=200)`:
- Lee `immutable_audit_event` (ultimos 200 por `block_height desc`).
- Llama `verify_audit_chain(p_tenant_id)` (RPC), que por cada bloque recomputa el hash y valida el enlace
  `previous_hash` -> devuelve `hash_ok` y `link_ok`. Un bloque esta "verificado" si `hash_ok && link_ok`.
- `stats = { total, verified, broken }`.
- Definiciones en `sql/0003_ledger.sql`:
  - `compute_audit_hash(...)`: SHA-256 sobre texto canonico (tenant|prev_hash|ts|actor|action|entity|payload|height),
    funcion `immutable`.
  - `append_audit_event(...)`: **unico camino de escritura**, `SECURITY DEFINER`, hash-chaining por tenant,
    serializado con `pg_advisory_xact_lock` (evita carreras en `previous_hash`/`block_height`).
  - Inmutabilidad: triggers `prevent_audit_mutation` bloquean UPDATE/DELETE (append-only).
  - `verify_audit_chain(p_tenant_id)`: recomputa hash + valida enlace con `lag()`.
  - Trigger generico `audit_row_change()` (AFTER I/U/D) registra mutaciones de maestros; actor tomado de
    GUCs de sesion `app.current_actor_id`/`app.current_actor_type` (default `system`).
- RLS (`sql/0004_rls.sql`): `audit_read` -> SELECT solo del propio tenant; **sin** policies de
  insert/update/delete para `authenticated` (solo se escribe via `append_audit_event`, security definer).

**7. Flujos clave.** Auditor abre `/ledger` -> ve integridad 100% (o bloques rotos) -> filtra por entidad/actor
-> exporta CSV de evidencia. Si alguien intentara alterar un bloque, `verify_audit_chain` marcaria
`hash_ok=false` y el banner pasaria a rojo.

---

## E9 — `/mi-dia` (Cockpit del Operador)

**1. Ruta y parametros.** `app/(app)/mi-dia/page.tsx`. Sin parametros. Guard de ruta `incident.read`.

**2. Modulo/categoria.** Persona **Operador** (`support_agent`) — `SUPPORT_AGENT_NAV` grupo `ag.dia`
(`lib/nav/navigation.ts`), item `nav.miday`. Es el **home** del operador (`role-ux.ts`).

**3. Proposito.** Cockpit personal del operador: SOLO datos del operador autenticado, cero KPIs globales
de la mesa (comentario en la pagina). "Como voy hoy".

**4. Roles y permisos.** Persona `support_agent`. Segregacion dura por `ROLE_ROUTE_DENY.support_agent`
(deniega dashboard, torre, triage, admin, ledger, catalog, etc.) + perms recortados (`sql/0112`) + regla de
oro backend (`lib/auth/incident-authz.ts`).

**5. Pantalla.** Componente `components/operador/mi-dia.tsx` (`OpDayView`), saludo con `firstName`.

**6. Funcional/tecnico.** `lib/operador/queries.ts` -> `getMyDay(supabase, accountId, firstName)`. Tablas
usadas por el modulo operador: `incident`, `team_member`, `case_survey`, `incident_duplicate_link`,
`member_evaluation`, `member_skill`. Todo acotado al `accountId`/miembro. (Detalle interno de `getMyDay`
no desglosado aqui — **(no verificado)** campo a campo.)

**7. Flujos clave.** El operador entra a la app -> `role-ux` lo lleva a `/mi-dia`.

---

## E10 — `/mis-casos` (Casos del Operador)

**1. Ruta y parametros.** `app/(app)/mis-casos/page.tsx`. Guard `incident.read`.

**2. Modulo/categoria.** Operador (`SUPPORT_AGENT_NAV` grupo `ag.casos`), item `nav.miscasos`.

**3. Proposito.** Los casos asignados al operador + la **cola del equipo en solo lectura** (contexto). El
operador NO toma de la cola (la recibe asignada).

**4. Roles y permisos.** `support_agent`; `incident.read`. El item hermano `/cola-equipo` es `readOnly`.

**5. Pantalla.** Componente `components/operador/mis-casos.tsx` (`OpCasesView`): casos propios, no
asignados (cola), contadores de duplicados, flag `linked` (si el account tiene `team_member`).

**6. Funcional/tecnico.** `getMyCases(supabase, accountId)`, `getTeamQueue(...)`, `getDuplicateCounts(ids)`
(`lib/operador/queries.ts`) + `getMyMemberId(supabase, accountId)` (`lib/incidents/queries.ts`, resuelve el
`team_member.id` del usuario). Tablas: `incident`, `incident_duplicate_link`, `team_member`. RLS por tenant
+ regla de oro de autorizacion de incidentes (`incident-authz.ts`).

**7. Flujos clave.** Operador ve sus casos -> abre el detalle en `/incidents/[id]` (no denegado para su rol).

---

## E11 — `/mi-desempeno` (Desempeno del Operador)

**1. Ruta y parametros.** `app/(app)/mi-desempeno/page.tsx`. Guard `incident.read`.

**2. Modulo/categoria.** Operador (`SUPPORT_AGENT_NAV` grupo `ag.yo`), item `nav.midesempeno`.

**3. Proposito.** Metricas de desempeno **propias** del operador (sin comparar con otros).

**4. Roles y permisos.** `support_agent`, `incident.read`.

**5/6. Pantalla y tecnico.** `components/operador/mi-desempeno.tsx` (`OpPerformanceView`); datos de
`getMyPerformance(supabase, accountId, firstName)` (`lib/operador/queries.ts`). Usa `case_survey`
(CSAT), `member_evaluation`, `member_skill`, `incident`. (Composicion interna **(no verificado)** en detalle.)

**7. Flujos clave.** Autoconsulta de rendimiento.

---

## E12 — `/notificaciones` (Notificaciones del Operador)

**1. Ruta y parametros.** `app/(app)/notificaciones/page.tsx`. Sin guard de permiso propio en
`ROUTE_PERMISSIONS` (el item `nav.notificaciones` no declara `perm`); accesible a autenticados. En la
practica esta en el nav del operador.

**2. Modulo/categoria.** Operador (`SUPPORT_AGENT_NAV` grupo `ag.yo`), item `nav.notificaciones`.

**3. Proposito.** Bandeja de notificaciones del usuario (campanita v1) en pantalla completa.

**4. Roles y permisos.** La RLS de `notification` ya limita a las notificaciones del propio usuario
(recipient + tenant), asi que las consultas no necesitan filtro extra (comentario en
`lib/notifications/queries.ts`).

**5. Pantalla.** Componente `components/operador/notificaciones.tsx` (`OpNotificationsView`). Copys
`"notif.*"` (titulo, "Marcar todas", vacio, "ahora").

**6. Funcional/tecnico.** Carga: `listNotifications(supabase, 50)` — `select` de `notification` orden por
`created_at desc`, mas conteo de no leidas (`is_read=false`). Mutaciones (`lib/notifications/actions.ts`):
`markNotificationRead`, `markAllNotificationsRead`, `fetchNotifications`. Tabla `notification` en
`sql/0096_notifications.sql` (+ purga de seed en `sql/0120_purge_seed_notifications.sql`). La **campanita del
header** reutiliza `listNotifications` desde el layout.

**7. Flujos clave.** Ver / marcar leidas.

---

## E13 — `/mi-trabajo` (Cockpit del Miembro de Squad)

**1. Ruta y parametros.** `app/(app)/mi-trabajo/page.tsx`. Guard `project.read`.

**2. Modulo/categoria.** Persona **Miembro de Squad** (`squad_member`) — `SQUAD_MEMBER_NAV` grupo
`sm.trabajo`, item `nav.mywork`. Es el **home** del squad_member (`role-ux.ts`).

**3. Proposito.** Todo lo del miembro acotado a la persona (`assigned_member_id`) y a sus squads vigentes.

**4. Roles y permisos.** `squad_member`; `project.read`. Segregacion dura
`ROLE_ROUTE_DENY.squad_member` (deniega `/projects`, `/squads`, `/workload`, `/evolucion`,
`/casos-convertidos`, `/rules`, `/ai-center`): usa las rutas `/mi-*` acotadas.

**5/6. Pantalla y tecnico.** `components/squad-member/my-work.tsx` (`MyWorkView`); datos de
`getMyWork(supabase, accountId, firstName)` (`lib/squad-member/queries.ts`). Tablas del modulo:
`project`, `project_task`, `squad`, `squad_member`, `team_member`, `member_evaluation`, `member_skill`.

**7. Flujos clave.** El miembro entra -> `/mi-trabajo`.

---

## E14 — `/mi-squad` (Mis squads)

**1. Ruta y parametros.** `app/(app)/mi-squad/page.tsx`. `searchParams.squad` opcional (selecciona el squad
activo si pertenece a los del miembro). Guard `squad.read`.

**2. Modulo/categoria.** Miembro de Squad (`SQUAD_MEMBER_NAV` grupo `sm.squads`), item `nav.mysquad`.

**3. Proposito.** Pertenencia, proposito y coordinacion, acotado a los squads de la persona.

**4. Roles y permisos.** `squad_member`; `squad.read`.

**5/6. Pantalla y tecnico.** `components/squad-member/my-squad.tsx` (`MySquadView`).
- `getMyMemberId(supabase, accountId)` (via `lib/incidents/queries.ts`) -> `getMySquads(memberId)` y
  `getMySquadDetail(memberId, squadId)`. Selecciona `squadId` de la URL si es valido, si no el primero.
- `linked = !!memberId`. Maestros nuevos (objetivos, vinculo RC) degradan a estado vacio si no cargados.
- Tablas `squad`, `squad_member`, `team_member`.

**7. Flujos clave.** Cambiar de squad via `?squad=`.

---

## E15 — `/mis-iniciativas` (Iniciativas del Squad)

**1. Ruta y parametros.** `app/(app)/mis-iniciativas/page.tsx`. Guard `project.read`.

**2. Modulo/categoria.** Miembro de Squad (`SQUAD_MEMBER_NAV` grupo `sm.iniciativas`), item `nav.myinitiatives`.

**3. Proposito.** Proyectos de MIS squads, **sin** caso de negocio financiero, **sin** WSJF global, **sin**
hilo del caso ancla (§5 del comentario). Solo lectura del avance propio/equipo.

**4. Roles y permisos.** `squad_member`; `project.read`.

**5/6. Pantalla y tecnico.** `components/squad-member/my-initiatives.tsx` (`MyInitiativesView`).
`getMyMemberId` -> `getMyInitiatives(memberId)` (`lib/squad-member/queries.ts`). Tablas `project`,
`project_task`, `squad_member`.

**7. Flujos clave.** Consulta de iniciativas del equipo.

---

## E16 — `/mi-perfil` (Perfil del Miembro)

**1. Ruta y parametros.** `app/(app)/mi-perfil/page.tsx`. Guard `project.read`.

**2. Modulo/categoria.** Miembro de Squad (`SQUAD_MEMBER_NAV` grupo `sm.perfil`), item `nav.myprofile`.

**3. Proposito.** Perfil **solo lectura**: asignaciones vigentes, competencias, evaluaciones propias. La
edicion vive en Talento (gerente) y chapters.

**4. Roles y permisos.** `squad_member`; `project.read`.

**5/6. Pantalla y tecnico.** `components/squad-member/my-profile.tsx` (`MyProfileView`);
`getMyProfile(supabase, accountId)` (`lib/squad-member/queries.ts`). Tablas `team_member`,
`member_skill`, `member_evaluation`. El Chapter degrada si no esta cargado.

**7. Flujos clave.** Autoconsulta de perfil.

---

## E17 — `/` (Landing) y `/start` (router de home por rol)

**Landing `app/page.tsx`.** Pantalla publica de marca (negro Credix `#0A0A0B`, fija, no afectada por el
tema). CSS inline. Contiene el login (`components/landing/landing-login.tsx`): al autenticar cae directo en
la app. Si ya hay sesion, ofrece "Ir a la plataforma" -> `/start`. Logo `/credix-logo.png`, marca
rojo `#E42313`. **Nota:** los pilares (`PILLARS`) y metricas (`STATS`) son texto de marketing **hardcodeado**
en el componente (148 incidentes/mes, 18% conversion, etc.) — es contenido de landing, no dato de negocio
operativo, pero conviene marcarlo **(hardcode de marketing, no conectado a BD)**.

**`/start` `app/start/page.tsx`.** Router de "home por rol". Sin sesion -> `/`. Con sesion: RPC
`my_permissions()` + `my_roles()` -> `resolveHome(roleList, perms, isAdmin)` (`lib/nav/role-ux.ts`) ->
`redirect` al home del rol (ops->/operaciones, evolucion->/evolucion, squad->/mi-trabajo,
operador->/mi-dia, usuario final->/portal, admin->/dashboard). Sin shell (evita el flash del layout).
Nota: `/start` usa las RPC separadas `my_permissions`/`my_roles`, mientras el resto de la app usa la
unificada `my_access()` (T1).

---

## E18 — `/unauthorized`

`app/(app)/unauthorized/page.tsx` -> componente `components/app-shell/unauthorized.tsx` (`Unauthorized`).
Destino de los `redirect("/unauthorized")` del layout cuando el guard de permiso o la denylist de persona
bloquean una ruta. Se renderiza dentro del shell (sidebar/header presentes).

---

# TEMAS TRANSVERSALES (columna vertebral del manual tecnico)

## T1 — Modelo de roles y permisos (RBAC)

**Roles (tabla `role`, globales `tenant_id=null`, `is_system=true`)** — seed en
`sql/0012_seed_inventory.sql`:

| code | nombre | descripcion (seed) |
|------|--------|--------------------|
| system_admin | Administrador del sistema | Admin tecnico global |
| tenant_admin | Administrador de tenant | Admin por tenant |
| support_agent | Agente de soporte | Gestion de incidentes (persona **Operador**) |
| support_lead | Lider de soporte | Escalamiento, cierre, RCA (persona **Gte. Operaciones**) |
| product_owner | Product Owner | Priorizacion y proyectos (persona **Gte. Evolucion**) |
| business_owner | Business Owner | Decisiones de negocio |
| change_manager | Change Manager | Cambios y releases |
| grc_officer | GRC Officer | Riesgo, cumplimiento, controles |
| auditor | Auditor | Solo lectura + exportaciones |
| partner_user | Usuario partner | Portal externo restringido (persona **Usuario final**) |
| partner_admin | Admin partner | Usuarios del partner |
| ai_agent | Agente IA | Identidad tecnica de agente |
| squad_member | Miembro de Squad | (persona; rol anadido en `sql/0050_squad_member.sql`/`0069`) — **(rol no en el bloque 0012; verificado que la persona existe en nav/access)** |

**Permisos (tabla `permission`, catalogo global).** El seed base `0012` inserta ~23 permisos; el
**conjunto completo (66) y el mapeo rol->permiso vigente** viven en el snapshot
`sql/seed/snapshot_anon/permission.csv` + `sql/seed/snapshot_anon/role_permission.csv`, y se **amplian** en
migraciones posteriores (ej. `0068_my_access`, `0070_partner_user_perms`, `0088/0090_partner_admin`,
`0091_evolution_rbac`, `0107_admin_all_permissions`, `0108/0109_support_lead`, `0112_support_agent_operador_perms`,
`0072_product_owner_incident_read`). Familias de permiso (resource.action): incident, problem, change,
project, rule, audit, cmdb, knowledge, tenant, user, grc, agent, recommendation, talent, masterdata, risk,
sla, workflow, major_incident, vendor, squad, area, triage, worklog, survey, observability, fraud, dispute,
service_catalog, process. Los que gatean el CLUSTER E: `user.manage` (/admin), `masterdata.manage`
(/catalog), `cmdb.read` (/cmdb), `audit.read` (/ledger).

**Resolucion de acceso (runtime).**
- RPC `my_access()` (`sql/0074_my_access_fn.sql`, `SECURITY DEFINER`): devuelve `{perms[], roles[]}`
  en un solo viaje, uniendo `user_account -> user_role (vigente: valid_to null o futuro) -> role_permission
  -> permission`. Reemplaza a `my_permissions` + `my_roles`.
- `getAccessControl()` (`lib/auth/session.ts`, cacheada por request): llama `my_access()` y calcula
  `isAdmin = roles incluye system_admin || tenant_admin`.
- `hasPermission(supabase, code)` (`lib/auth/context.ts`): `isAdmin || perms.includes(code)` (bypass admin
  consistente con nav/guards). El parametro supabase se conserva por compatibilidad.
- RPC `has_permission` existe a nivel BD **(no verificado en esta doc su firma exacta)**; la app usa la via
  cacheada.

**Guards (capa de aplicacion).** En `app/(app)/layout.tsx`:
1. `requiredPermForPath(pathname)` (`lib/nav/access.ts`, `ROUTE_PERMISSIONS` por prefijo mas especifico) +
   `canSeeNav(...)` -> `/unauthorized` si falta el permiso.
2. `isRouteDeniedForRoles(pathname, roles)` (`ROLE_ROUTE_DENY` por persona) -> `/unauthorized` aunque tenga
   el permiso (segregacion dura de persona). Admin nunca se bloquea.

**Tabla rol -> descripcion -> home -> que ve** (home/enfasis de `lib/nav/role-ux.ts`, nav de `navigation.ts`):

| rol | home | que ve (nav) |
|-----|------|--------------|
| system_admin / tenant_admin | /dashboard | MACRO_NAV completa (8 categorias) |
| support_lead (Gte. Operaciones) | /operaciones | OPERATIONS_NAV (Torre, Casos, Equipo, Disputas, Catalogo+SLA); denylist Evolucion/definicion, Clientes, Riesgo |
| support_agent (Operador) | /mi-dia | SUPPORT_AGENT_NAV (Mi dia, Mis casos/cola RO, Crear, KB, Yo) |
| product_owner (Gte. Evolucion) | /evolucion | EVOLUTION_NAV (Evolucion, Estrategia, Ejecucion, Analisis360, Inteligencia, KM) |
| squad_member (Miembro) | /mi-trabajo | SQUAD_MEMBER_NAV (Mi trabajo, Mis squads, Iniciativas, Perfil, Ayuda) |
| partner_user (Usuario final) | /portal | USER_NAV plano (Autoservicio, Conocimiento, Catalogo) + menu de portal |
| auditor | /ledger | (MACRO_NAV filtrada por perm); accion primaria "verifyLedger" |
| business_owner / grc_officer / change_manager / people_lead / responsable_comercial | segun ROLE_UX | MACRO_NAV filtrada por perm |

Nota clave: la segregacion de persona (overlay de nav + denylist) SOLO aplica a un usuario de **UNA sola**
persona interna (`solePersona`, `INTERNAL_PERSONA_ROLES`); un multi-persona (power-user) recibe MACRO_NAV
completa gateada por perm.

## T2 — Navegacion (8 categorias macro + overlays por persona)

Fuente unica: `lib/nav/navigation.ts` (`MACRO_NAV`). El sidebar y el Command Menu la consumen; NO se
hardcodea navegacion en componentes. Cada item conserva su `path` real y su `perm` (mismo candado que
`ROUTE_PERMISSIONS`).

**8 categorias macro** (en orden del sidebar):
1. **Inicio** (`home`): Dashboard, Mi trabajo (workspace).
2. **Tickets** (`inbox`): Incidentes, Triage, Incidentes mayores, Catalogo de servicios, Autoservicio.
3. **Operaciones** (`sliders`): Op home, SLA, Clientes, Fraude/disputas, Riesgo.
4. **Evolucion** (`zap`): Ev home, Mapa de tribus, Proyectos, Portafolio, Casos convertidos, Problemas,
   Cambios, Squads, Observabilidad, Dependencias, Proveedores.
5. **Talento** (`users`): Talento, Recursos (workload), Areas de entrega.
6. **Conocimiento** (`sparkle`): Conocimiento, Revision KB, AI Center, Reglas, Workflows.
7. **Analitica** (`activity`): Analitica, Comportamiento.
8. **Administracion** (`gear`): Admin, Dominios SSO, Catalogo (Datos Maestros), Procesos, CMDB, Ledger.

**Overlays por persona** (`PERSONA_NAV`, se aplican via `navForRoles(roles, isAdmin)`):
`EVOLUTION_NAV` (product_owner), `OPERATIONS_NAV` (support_lead), `SQUAD_MEMBER_NAV` (squad_member),
`SUPPORT_AGENT_NAV` (support_agent), `USER_NAV` (partner_user, portal plano). Los overlays de personas
internas se construyen por **referencia a los ids canonicos** de MACRO_NAV (`buildRoleNav`) para que
path/perm nunca diverjan; solo se reagrupan y renombran etiquetas. `role-ux.ts` define el **enfasis**
(categorias que se auto-expanden), el `home` y la `primaryAction` (CTA del header).

## T3 — Multi-tenant + RLS

Invariante: todo dato operativo lleva `tenant_id` + RLS (`CLAUDE.md` §3.2 #3). Patron Supabase: `ENABLE
ROW LEVEL SECURITY` (no FORCE); `service_role` y funciones `SECURITY DEFINER` (BYPASSRLS) operan; el rol
`authenticated` queda aislado por tenant. La funcion `public.current_tenant_id()` (definida en
`sql/0002_tenant_identity.sql`, endurecida en `sql/0006`) resuelve el tenant del usuario autenticado.

Ejemplos de policy (`sql/0004_rls.sql`):
- `tenant`: `id = current_tenant_id()` (su tenant es su propio id).
- `party`, `party_role`, `user_account`: `tenant_id = current_tenant_id()` (using + with check).
- `immutable_audit_event`: SOLO SELECT por tenant (`audit_read`); sin policies de escritura (append-only via
  funcion security definer).
- `role`: lectura de roles globales (`tenant_id is null`) + del tenant; escritura solo del tenant.
- `permission`: catalogo global de solo lectura (`using true`).
- `role_permission` / `user_role`: alcance via el padre (role/user).
- `sso_allowed_domain`: `sso_domain_isolation` por tenant (`sql/0130`).

Toda tabla de catalogo/maestro del cluster (`business_unit`, `product`, `configuration_item`, etc.) lleva
`tenant_id` y el upsert de `lib/masterdata/actions.ts` fuerza `tenant_id: ctx.tenantId` en el INSERT y
valida FKs `.eq("tenant_id", ctx.tenantId)`.

## T4 — Ledger / audit-grade (hash-chaining)

Definido en `sql/0003_ledger.sql` (endurecido en `sql/0064_audit_atomic.sql`, `0132`, `0133`). Tabla
`immutable_audit_event` con `block_height`, `previous_hash`, `current_hash`, `actor_type/id`, `action`,
`entity_type/id`, `payload jsonb`, correlacion/causacion. Indices unicos por `(tenant_id, block_height)` y
`(tenant_id, current_hash)` — **una cadena por tenant**.

Piezas:
- `compute_audit_hash(...)`: SHA-256 (`extensions.digest`) sobre texto canonico ordenado; funcion `immutable`.
- `append_audit_event(...)`: **unico camino de escritura**, `SECURITY DEFINER`; toma `previous_hash` +
  `block_height` del ultimo bloque del tenant, serializado con `pg_advisory_xact_lock(hashtext('credix_ledger'),
  hashtext(tenant))` para evitar carreras. Falla si `tenant_id` es null.
- Inmutabilidad: triggers `trg_prevent_audit_update`/`_delete` -> `prevent_audit_mutation()` (append-only).
- `verify_audit_chain(p_tenant_id)`: por bloque devuelve `hash_ok` (recomputo) y `link_ok` (enlace con el
  bloque anterior via `lag()`). Es lo que consume `/ledger`.
- Trigger generico `audit_row_change()` (AFTER I/U/D) para maestros: arma payload before/after, toma actor
  de GUCs `app.current_actor_id` / `app.current_actor_type` (default `system`) y llama `append_audit_event`.
  Adjunto a `tenant` (via `audit_tenant_change`), `party`, `party_role`, `user_account`, y demas maestros.

Principio (§11): ninguna mutacion relevante existe sin su `immutable_audit_event`; si no se puede registrar,
la operacion falla y revierte (transaccion). **(No verificado)** una seccion "§10" formal en `docs/SPEC.md`
(el grep no encontro el encabezado; la regla vive en `CLAUDE.md` §11 y en el SQL).

## T5 — i18n ES/EN

`lib/i18n/dictionaries.ts`: diccionario de claves planas por dominio, `{ es: {...}, en: {...} }` (~5.500
lineas de entradas). `type MessageKey` = claves del objeto `es` -> **tipado fuerte**: usar una clave
inexistente es error de compilacion. ES por defecto, EN obligatorio (`CLAUDE.md` §11).

`lib/i18n/provider.tsx` (`I18nProvider`, client): estado `locale` persistido en `localStorage`
(`credix.locale`), `document.documentElement.lang` sincronizado. `t(key)` = `dict[locale][key] ?? dict.es[key]
?? key` (fallback a ES y luego a la clave cruda). `useErrorMessage()` traduce codigos `ERR_*` via `"err."+code`.

Convenciones de clave del cluster: `md.*` (datos maestros), `led.*` (ledger), `cmdb.*`, `adm.*` (admin),
`sso.admin.*`, `notif.*`, `nav.*` (navegacion, incl. overlays por persona `nav.ag.*`, `nav.sm.*`,
`nav.op.*`, `nav.ev.*`, `nav.user.*`), `err.*` (errores de validacion).

## T6 — Design system (temas Nexus/Claro, marca)

Fuente de verdad: Design System oficial de Credix (export Figma -> tokens en `design-system/source/`,
generados a `design-system/generated/credix-tokens.css` via `scripts/generate-credix-tokens.mjs`). El CSS
generado tiene capa cruda (`--credix-colors-*`, escalas de primitivos) y capa curada
(`--credix-color-*`, `--credix-radius-*`).

`app/globals.css` define dos temas conmutables con `[data-theme="..."]`:
- **Nexus** (oscuro, se conserva): `--bg:#0B0C0E`, `--accent:#E42313`, `--accent-2:#FF8A77` (IDs/enlaces),
  `--accent-bright:#FF553F`, CTA rojo.
- **Claro** (claro, alineado al esquema Baseline oficial): `--bg:` surface `#F7FAFC`, `--accent:#E42313`,
  `--accent-2:#BF0600`.
- **Marca = rojo Credix `#E42313`** (primitivo rojo 50 del DS) en AMBOS temas, solo para acciones/acentos.
- **Fuente oficial Heebo** (UI + titulos); cifras numericas en **mono** (`--font-mono`, IBM Plex Mono en Claro).
- El **teal/verde-agua** (`--teal:#2DD4BF` / `#2A7568`) es color de **dato secundario** (data-viz),
  NO acento de marca.
- El portal del rol Usuario tiene **Claro como tema por defecto**.

Variables semanticas usadas en el cluster: `--card`, `--line`, `--muted`, `--text`, `--r-xl/--r-md/--r-sm`,
`--st-critical*`, `--st-low*`, `--st-verified` (ledger), `--cta-bg/--cta-fg`. Para que Claude Design lo
respete: NO introducir colores fuera de estos tokens, marca siempre `#E42313`, numeros en mono, doble tema.
Detalle en `docs/ui/CREDIX_DESIGN_SYSTEM_INTEGRATION.md` y `docs/DESIGN.md`.

## T7 — Stack y arquitectura (estructura de carpetas)

Monolito modular **Next.js 16 App Router + React 19 + TS** sobre **Supabase** (Postgres 17, Auth, RLS,
Storage, Realtime). Kafka/Temporal/OPA quedan como evolucion futura (no en v1). Proyecto Supabase
`CREDIXNEXUS` ref `dffbysjrvvlwgzgakhaa`.

Estructura relevante:
- `app/page.tsx` (landing), `app/start/` (router de home), `app/(auth)/` + `app/auth/` (login/OAuth),
  `app/(app)/` (shell autenticado con `layout.tsx` que monta sidebar/header/command-menu + aplica guards).
- `app/(app)/<modulo>/page.tsx` — Server Components que orquestan `getContext()` + queries + componente cliente.
- `components/<dominio>/` — UI por dominio (`admin`, `masterdata`, `ledger`, `cmdb`, `operador`,
  `squad-member`, `app-shell`, `common`, `ui`).
- `lib/<dominio>/` — logica de dominio: `queries.ts` (lectura), `actions.ts` (server actions/mutaciones),
  `registry.ts` (metadata). Transversales: `lib/auth/` (session, context, sso, incident-authz),
  `lib/nav/` (navigation, access, role-ux), `lib/i18n/`, `lib/supabase/` (clientes), `lib/validation.ts`
  (`ErrorCode`).
- `sql/` — migraciones versionadas (0001..0139), idempotentes donde se pueda; el esquema real de Supabase
  manda. Seed en `sql/seed/` (incl. snapshot anonimizado con la matriz rol/permiso vigente).
- `docs/` — SPEC, DESIGN, arquitectura, auth/sso.

Datos maestros = **whitelist en codigo (metadata de esquema) + valores en BD**: `lib/masterdata/registry.ts`
describe estructura/validaciones por catalogo; el CRUD generico (`MdIndex/MdList/MdForm` + `actions.ts`)
opera sobre cualquier catalogo del registro. Validacion en 3 capas (frontend `md-form`, servicio
`actions.upsertRecord`, BD constraints/unique/FK) alineada con `CLAUDE.md` §10.

---

## Notas / supuestos / (no verificado)

- `squad_member` como fila de `role` no aparece en el bloque de roles de `sql/0012`; su persona y perms se
  introducen en migraciones posteriores (`0050`, `0069`). Verificado que la persona existe en nav/access;
  **no verificada** la fila exacta de seed.
- No se localizo un encabezado "§10" formal en `docs/SPEC.md` por grep; la regla audit-grade esta en
  `CLAUDE.md` §11 y materializada en `sql/0003_ledger.sql`.
- Landing (`app/page.tsx`): pilares y metricas son **texto de marketing hardcodeado** (no conectado a BD).
  Es contenido de marca, no dato de negocio operativo, pero se señala por transparencia.
- La composicion interna detallada de `getMyDay`/`getMyPerformance`/`getMyWork` (modulos operador y
  squad-member) no se desgloso campo a campo; se listaron las tablas que tocan.
- No se verifico caso por caso que los 12 catalogos tengan el trigger `audit_row_change` adjunto; el
  mecanismo generico existe y esta adjunto a los maestros de identidad en `sql/0003`.
