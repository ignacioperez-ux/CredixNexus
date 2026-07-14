# Sub-Fase 1.0 — Inventario y matriz de correspondencia · rol **Gerente de Evolución**

> **Modo:** Arquitecto (solo lectura; sin código de producción).
> **Alcance:** experiencia del rol Gerente de Evolución. Fuente de verdad: **código + esquema vivo**.
> **Fecha:** 2026-07-14.
> **Disciplina:** HECHO (verificado en código/BD) · INTERPRETACIÓN · HIPÓTESIS.
> **Insumos:** análisis de las 38 capturas (20 pantallas P1–P20) + plan de Claude Design. Aquí se
> **verifica** contra la realidad del repo, no se asume.

---

## 1. Identificación del rol (HECHO)

El Gerente de Evolución = rol **`product_owner`** (`role.name` = "Product Owner"; `ROLE_UX`:
emphasis `evolucion/conocimiento/analitica`, home `/dashboard`, primaryAction `newProject`).

**Permisos vivos (BD, 2026-07-14):**
`incident.read` · `change.read` · `problem.read` · `problem.manage` · `project.read` ·
`project.manage` · `recommendation.read` · `rule.read` · `process.read` · `squad.read` ·
`vendor.read` · `workflow.read` · `major_incident.read` · `service_catalog.read` ·
`service_catalog.request` · `knowledge.feedback`.

**NO tiene:** `triage.manage`, `sla.*`, `fraud/dispute.*`, `risk.*`, `observability.*`, `cmdb.*`,
`area.*`, `audit.*`, `talent.*`, **`knowledge.read`**, `change.approve`, `change.manage`,
`project.deploy`, `project.validate`, `recommendation.decide`, `squad.manage`, `vendor.manage`,
`incident.create/update/assign/resolve`, `user.manage`, `masterdata.manage`.

---

## 2. Hallazgo estructural (HECHO) — el rol NO está segregado

`product_owner` tiene **`incident.read`**, que en `ROUTE_PERMISSIONS` (lib/nav/access.ts) **gatea de
golpe** cinco superficies operativas + dos legítimas:

| Ruta | Gate | ¿Accede? | Debería |
|---|---|---|---|
| `/dashboard` | incident.read | ✅ | **RETIRAR** (dashboard operativo) |
| `/workspace` | incident.read | ✅ | **RETIRAR** (cockpit de agente) |
| `/incidents` | incident.read | ✅ | **RETIRAR** bandeja cruda → Bandeja de Evolución |
| `/customers` | incident.read | ✅ | **RETIRAR** (PII individual) → agregado |
| `/analytics` | incident.read | ✅ | **RESTRINGIR** (Ejecutivo/Reportes sí; Supervisor/agente no) |
| `/ai-center` | incident.read | ✅ | **CORRESPONDE** (P16) |
| `/incidents/[id]` | incident.read | ✅ | **RESTRINGIR** (lectura enriquecida, sin acciones de mesa) |

> **Nudo arquitectónico (HECHO):** `incident.read` está **sobrecargado** — otorga lo operativo
> (malo) Y `/ai-center` + la lectura del detalle de caso derivado (necesario). **No se puede
> simplemente quitar `incident.read`**: rompería ai-center y la lectura de casos. La segregación
> exige **rediseñar la granularidad de permisos/gates de ruta** (p.ej. `ai-center` con permiso
> propio; lectura de caso derivado con un permiso acotado tipo `incident.read_evolution`). Es un
> cambio de **RBAC/backend** (migración + `ROUTE_PERMISSIONS`), zona STOP §2.4.

---

## 3. Defectos de gobierno confirmados en código (HECHO)

1. **Auto-derivación.** `components/incidents/detail/evolution-panel.tsx` muestra el botón **"Enviar
   a Evolución"** sin gate en el componente; `sendToEvolution` (lib/incidents/actions.ts) exige
   `anyPerm(["incident.update","problem.manage","project.manage"])`. `product_owner` tiene
   `problem.manage`+`project.manage` → **puede derivarse casos él mismo**, anulando el gate de
   Operaciones. *(Confirma el defecto #1 del análisis.)*
2. **Edición de problemas.** `product_owner` tiene **`problem.manage`** → puede editar el ciclo de
   vida del problema (P11 dice: solo lectura + vincular a proyecto).
3. **"Decide el RC" (aclarado).** `recommendation.decide` lo tiene **`business_owner`** ("Business
   Owner / Decisiones de negocio"), NO `product_owner` (que solo tiene `recommendation.read`). El
   "RC" es un rol real. Falta fijar contractualmente: **Operaciones deriva · Evolución acepta ·
   negocio (RC) decide recomendaciones · el motor solo recomienda.**
4. **Umbral automático ≥85** del motor (`/rules`, TRANSFORM_CREDIX_001) — pendiente de verificar si
   ejecuta derivación real o solo marca candidato (a confirmar en 1.1).

---

## 4. Gaps de permisos (HECHO) — funciones del rol que HOY no puede ejercer

El modelo atribuye estas funciones al Gerente de Evolución, pero los permisos no las habilitan:

| Función esperada (modelo) | Permiso faltante | Efecto hoy |
|---|---|---|
| Gestionar squads y su membresía | `squad.manage` (solo tiene read) | Ve squads, no los administra |
| Gestionar talento/competencias/evaluaciones de squads | `talent.read/manage` | **No accede a `/talent`** |
| Consultar la base de conocimiento | `knowledge.read` | **No abre `/knowledge`** (solo feedback) |
| Autorizar pase a producción (gate de Evolución) | `project.deploy` (lo tiene change_manager) | El gate que el modelo le asigna vive en otro rol |
| Ser miembro del CAB (aprobar) | `change.approve` (lo tiene change_manager) | Ve cambios, no aprueba |
| Gestionar scorecard de proveedores | `vendor.manage` | Ve proveedores, no gestiona |

> **INTERPRETACIÓN:** el rol hoy es "un supervisor de mesa (por `incident.read`) con un módulo de
> proyectos anexo, y sin las palancas de talento/conocimiento/gobierno que su mandato requiere". El
> rediseño debe **invertir esa proporción**.

---

## 5. Matriz de correspondencia pantalla ↔ rol (P1–P20)

Verdicto: **CORRESPONDE** · **RESTRINGIR** (solo lectura/acotar) · **RETIRAR** (va al rol correcto,
no se borra del sistema). Todas las filas verificadas contra permisos reales (§1–§2).

| P | Pantalla / ruta | Acceso hoy (HECHO) | Verdicto | Nota |
|---|---|---|---|---|
| P1 | Dashboard `/dashboard` | ✅ incident.read | **RETIRAR** | → **Panel de Evolución** (embudo, portafolio, capacidad, valor). Conservar inventario/arquitectura. |
| P2 | Casos `/incidents` | ✅ | **RETIRAR** | → **Bandeja de Evolución** (solo `in_evolution` + candidatos). Quitar "Enviar a Evolución". |
| P3 | Mi trabajo `/workspace` | ✅ | **RETIRAR** | Cockpit de agente; no aplica. |
| P4 | Detalle caso `/incidents/[id]` | ✅ | **RESTRINGIR** | Lectura enriquecida + cabecera de decisión; sin comunicación al cliente/checklist/SLA/derivación. Conservar ledger + bloque Fintech. |
| P5 | Incidentes mayores `/major-incidents` | ✅ major_incident.read | **RESTRINGIR** | Observador (sin comando; `major_incident.manage` no lo tiene). |
| P6 | Catálogo `/service-catalog` | ✅ service_catalog.read | **CORRESPONDE (usuario)** | Sacar de nav principal → "Ayuda / Mis solicitudes". |
| P7 | Autoservicio `/portal` | ✅ (libre) | **CORRESPONDE (usuario)** | Ídem. |
| P8 | Clientes `/customers` | ✅ | **RETIRAR** | PII individual → analítica agregada por segmento. |
| P9 | Proyectos `/projects` | ✅ project.read/manage | **CORRESPONDE (núcleo)** | + roadmap, capacidad, estado "Devuelto". |
| P10 | Detalle proyecto `/projects/[id]` | ✅ | **CORRESPONDE (núcleo)** | Gate de pase a producción hoy es `project.deploy` (change_manager) — **reasignar a Evolución** (§4). + value realization, desglose WSJF, trazabilidad. |
| P11 | Problemas `/problems` | ✅ problem.read+**manage** | **RESTRINGIR** | Quitar `problem.manage` → solo lectura + vincular a proyecto. + costo acumulado. |
| P12 | Cambios/CAB `/changes` | ✅ change.read | **CORRESPONDE** | Falta `change.approve` para ser miembro CAB (§4). + "cambios de mis proyectos". |
| P13 | Squads `/squads` | ✅ squad.read | **CORRESPONDE** | Falta `squad.manage` (§4). + skills matrix, velocity, normalizar utilización. |
| P14 | Proveedores `/vendors` | ✅ vendor.read | **CORRESPONDE** | Convertir en scorecard. `vendor.manage` opcional. |
| P15 | Recursos/Carga `/workload` | ✅ squad.read | **RESTRINGIR** | Capacidad por squad sí; carga por agente de Operaciones no. |
| P16 | AI Center `/ai-center` | ✅ incident.read | **CORRESPONDE** | Requiere no romperlo al segregar `incident.read` (§2). + métricas de valor. |
| P17 | Motor de reglas `/rules` | ✅ rule.read | **CORRESPONDE (visibilidad)** | "auto ≥85" → recomendación que confirma Operaciones. |
| P18 | Workflows `/workflows` | ✅ workflow.read | **RESTRINGIR** | Lectura de instancias; editar definiciones = admin. |
| P19 | Analítica `/analytics` | ✅ | **RESTRINGIR** | Ejecutivo/Reportes sí; Supervisor/Rendimiento-por-agente no. + pestaña **Evolución**. Corregir render CSAT. |
| P20 | Procesos/Matriz `/processes` | ✅ process.read | **CORRESPONDE** | Conectar con portafolio. |

**Rutas NO accesibles hoy** (por falta de permiso, coherente con el rol): `/triage`, `/sla-governance`,
`/fraud-disputes`, `/risk`, `/observability`, `/cmdb`, `/dependencies`, `/delivery-areas`, `/ledger`,
`/catalog`, `/admin`, **`/knowledge`**, **`/talent`**.

---

## 6. Componentes clave del rol (HECHO — dónde vive lo núcleo)

- Proyectos: `app/(app)/projects/*` + `components/projects/*` (portafolio, WSJF, business case IA, gate de calidad).
- Squads: `app/(app)/squads/*`, workload `app/(app)/workload/*`.
- Reglas/recomendaciones: `app/(app)/rules/*` + `components/rules/recommendations-queue.tsx` (`decideRecommendation`).
- Derivación: `components/incidents/detail/evolution-panel.tsx` + `sendToEvolution` (lib/incidents/actions.ts).
- Navegación por rol: `lib/nav/{navigation,role-ux,access}.ts` (RBAC + emphasis + home).
- Zona compartida (STOP antes de tocar): dashboard, incidents (tabla/detalle/split), analytics, problems, changes, major-incidents — usadas por Operaciones/otros roles.

---

## 7. Plan de sub-fases propuesto (para tu aprobación)

- **1.0 (este doc):** inventario + matriz + defectos + gaps. ✅
- **1.1 — RBAC y gobierno de la derivación (BLOQUEANTE):** rediseñar permisos/gates de ruta para
  segregar lo operativo sin romper ai-center/lectura de caso; quitar auto-derivación del rol; fijar
  decisores (Operaciones deriva · Evolución acepta · RC decide · motor recomienda). Migración +
  `ROUTE_PERMISSIONS` + ledger. *(Requiere tu decisión sobre el modelo de permisos.)*
- **1.2 — Navegación del rol:** menú en 3 bloques (Evolución · Gobierno · Consulta solo-lectura),
  retirar/ mover superficies, home = **Panel de Evolución**.
- **1.3 — Panel de Evolución (home nuevo) + Bandeja de Evolución.**
- **1.4 — Portafolio (WSJF desglosado, ROI real vs estimado, roadmap, capacidad prospectiva) +
  Squads & Talento (skills/velocity/evaluación).**
- **1.5 — Restricciones de solo-lectura (detalle de caso, problemas, MI, workflows, workload) +
  Analítica pestaña Evolución + Proveedores scorecard.**
- **1.6 — Cierre:** matriz de paridad 100% PRESERVADA/MEJORADA; verificación R2; deuda.

En paralelo (independiente): **Claro app-wide** ya aplicado (patrón `15_claro_redesign.md`; commit
`7b528b6`).

---

## 8. Supuestos y preguntas para la COMPUERTA

**Supuestos:** (1) "Gerente de Evolución" = `product_owner`. (2) Todo lo que se retira del rol
permanece en el rol correcto (Operaciones/Admin). (3) El rediseño puede tocar RBAC/rutas (backend)
en 1.1, con disciplina audit-grade.

**Preguntas de compuerta (P1.1 requiere decisión):**
- **PE-1 (RBAC):** ¿Se aprueba rediseñar el modelo de permisos para segregar `incident.read`
  (nuevo permiso para lectura de caso derivado + gate propio de ai-center), en vez de dejarlo
  sobrecargado? Es la llave de toda la segregación.
- **PE-2 (derivación):** ¿Quitar del rol el botón "Enviar a Evolución" y el toggle "Posible
  proyecto" (solo Operaciones deriva), y convertir el "auto ≥85" en recomendación que confirma
  Operaciones?
- **PE-3 (palancas faltantes):** ¿Otorgar a `product_owner` los permisos que su mandato requiere —
  `squad.manage`, `talent.read/manage`, `knowledge.read`, `change.approve`, `project.deploy`,
  `vendor.manage`? (define su verdadero alcance).
- **PE-4 (alcance sesión):** ¿Prefieres que ejecute las sub-fases 1.1→1.5 secuencialmente en esta
  sesión (con compuerta por bloque), o solo hasta cierto punto?

---

**STOP — ESPERANDO APROBACIÓN.**

No inicio la Sub-Fase 1.1 (RBAC/gobierno) hasta tu aprobación y las respuestas a PE-1…PE-4, por
tocar permisos/RLS/rutas (zona STOP §2.4) y afectar componentes compartidos con Operaciones (R1).
