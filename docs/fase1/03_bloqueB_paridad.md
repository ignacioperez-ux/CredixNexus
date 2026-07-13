# Sub-Fase 1.2 · Bloque B — Catálogo + Formularios de solicitud (+ fix P3) · reporte de paridad

> **Modo:** Implementador (plan A+B aprobado).
> **Alcance:** Catálogo de servicios + formularios de solicitud + **fix de seguridad P3** (UX-002/003/004) sobre superficies **compartidas** con Agente/Admin.
> **Fecha:** 2026-07-13.
> **Verificación (R7):** `npm run build` ✅ · `vitest` **246/246** ✅ · RLS aplicada y verificada en BD viva.

---

## 1. Archivos modificados / creados

| Archivo | Cambio | Compartido |
|---|---|---|
| `lib/catalog/queries.ts` | `listRequests({ ownerId, ownOnly })`: solicitante ve solo lo propio; gestor, todo. | Sí |
| `app/(app)/service-catalog/page.tsx` | Pasa `ownOnly=!canManage` + `ctx.accountId`. | Sí |
| `app/(app)/service-catalog/requests/[id]/page.tsx` | **Owner-check** (`notFound` si no gestor y no propietario) + `canViewIncident`. | Sí |
| `components/catalog/service-catalog.tsx` | Rótulo honesto de pestaña + `ownOnly` a la lista. | Sí |
| `components/catalog/request-list.tsx` | Filtro "solicitante" solo para gestor; vacío honesto. | Sí |
| `components/catalog/catalog-grid.tsx` | **Buscador** + chip SLA + hover-lift. | Sí |
| `components/catalog/request-form.tsx` | Chip explicativo (se creará un caso con SLA de Xh). | Sí |
| `components/catalog/request-detail.tsx` | **Stepper de cumplimiento** + fix del enlace "Caso ancla" (UX-004). | Sí |
| `lib/i18n/dictionaries.ts` | +9 claves ES/EN. | Aditivo |
| `sql/0084_service_request_owner_rls.sql` | **NUEVO** · helper `current_account_id()` + policy RESTRICTIVE de SELECT. **Aplicada a la BD viva.** | Infra |

---

## 2. Fix de seguridad P3 (bloqueador) — cerrado

| Hallazgo | Antes | Ahora | Capas |
|---|---|---|---|
| **UX-002** "Mis solicitudes" mostraba TODO el tenant | query sin filtro + RLS tenant-wide | **app:** `ownOnly=!canManage` → `.eq(requested_by_user_id)`; **RLS:** policy RESTRICTIVE `manage OR owner` | app + BD |
| **UX-003** detalle de solicitud IDOR a nivel tenant | `getRequest` sin owner-check | **app:** `notFound()` si no gestor y no propietario; **RLS:** misma policy | app + BD |
| **UX-004** enlace "Caso ancla" → `/unauthorized` | `<Link>` a `/incidents/[id]` siempre | link solo si `incident.read`; si no, tarjeta de info (sin navegación rota) | app |

**RLS aplicada (verificada en `pg_policies`):**
`service_request_isolation` (PERMISSIVE, tenant) **AND** `service_request_read_scope` (RESTRICTIVE, SELECT) = `has_permission('service_catalog.manage') OR requested_by_user_id = current_account_id()`. Escrituras (INSERT/UPDATE/DELETE, RPC `create_service_request`, workflow, fulfill) **sin cambios** (la policy solo estrecha SELECT). Nuevo helper `current_account_id()` (SECURITY DEFINER, espeja `current_tenant_id`).

---

## 3. Matriz de paridad — Áreas B, C y filas de seguridad

**Cero filas EN RIESGO.**

| ID | Funcionalidad | Estado | Nota |
|---|---|---|---|
| B-01 | Tabs (Catálogo/Mis solicitudes/Admin) | **PRESERVADA** | Admin sigue solo con `canManage`. |
| B-02 | Grid por categoría | **PRESERVADA** | — |
| B-03 | SLA por tarjeta | **MEJORADA** | Texto → chip SLA. |
| B-04 | Botón "Solicitar" + RequestForm | **PRESERVADA** | Intacto. |
| B-05 | Estado vacío catálogo | **PRESERVADA** | + estado "sin resultados" de búsqueda. |
| B-06 | (faltaba búsqueda) | **MEJORADA** | **Buscador** por nombre/descripción/categoría. |
| C-02 | Form dinámico (`form_schema`) | **PRESERVADA** | — |
| C-03 | Validación por campo | **PRESERVADA** | — |
| C-04 | `submitRequest` (RPC) | **PRESERVADA** | — |
| C-05 | Estados enviando/error/éxito | **PRESERVADA** | — |
| C-06 | Indicador requeridos | **PRESERVADA** | + chip explicativo de SLA. |
| D-02 | "Mis solicitudes" (KPIs/lista) | **MEJORADA** | Ahora **propias** (fix UX-002); rótulo honesto. |
| D-06 | Vacío de solicitudes | **MEJORADA** | Texto honesto propio/todos. |
| E-02 | Detalle de solicitud | **MEJORADA** | Owner-check (fix UX-003); datos intactos. |
| E-03 | Enlace caso ancla | **MEJORADA** | Fix UX-004 (link condicionado a `incident.read`). |
| E-04 | Acciones Cumplir/Cancelar (gestor) | **PRESERVADA** | Solo `canManage`, sin cambios. |
| E-NEW | **Stepper de cumplimiento** | **MEJORADA (nuevo)** | Solicitada→En curso→Cumplida (honesto, sin aprobación ficticia). |

---

## 4. Preservación de Agente/Admin (R1) — verificado por lógica

- **Gestor (`service_catalog.manage`: support_lead, change_manager, admins):** ve **todas** las solicitudes (`ownOnly=false`), pestaña "Solicitudes", filtro por solicitante presente, abre cualquier detalle (owner-check omitido por `canManage`), acciones Cumplir/Cancelar intactas, enlace ancla funcional (tienen `incident.read`). RLS: pasan por `has_permission('service_catalog.manage')`.
- **Consecuencia intencional (no regresión):** roles con `service_catalog.request` pero **sin** `manage` (p.ej. `support_agent`, `product_owner`, `business_owner`) ahora ven **solo sus propias** solicitudes — comportamiento correcto de mínimo privilegio (no podían gestionar ajenas de todos modos). Alineado con la decisión P3.

---

## 5. Disciplina HECHO / INTERPRETACIÓN / HIPÓTESIS

- **HECHO:** build ✅, 246 tests ✅. RLS aplicada y confirmada en `pg_policies`. `service_request` no tiene lectores fuera de `lib/catalog/*` (grep) → policy sin radio de impacto colateral. RPC `create_service_request` es SECURITY INVOKER y su `RETURNING` pasa la policy (el solicitante es dueño de la fila).
- **INTERPRETACIÓN:** el owner-check y la RLS son coherentes (app y BD aplican el mismo criterio propietario-o-gestor).
- **HIPÓTESIS / limitación de verificación:** la RLS **no se pudo ejercer end-to-end vía MCP** porque el MCP conecta con rol elevado (bypass de RLS). Se verificó **estructuralmente** (policy + predicado correctos); el guard efectivo en runtime lo da la sesión autenticada (app-layer + RLS). Recomendación: prueba manual con sesión `partner_user` en QA.

---

**STOP — ESPERANDO APROBACIÓN.**

Cambios **sin commitear**. ¿Reviso algo, **hago commit del Bloque B**, y/o avanzo al **Bloque C (Mis Casos + Detalle de caso)** — que incluye el **detalle de caso propio del Usuario (P2)** y CSAT (P4), con nuevo permiso acotado + RLS por `reported_by_user_id`?
