# Sub-Fase 1.5 — Solo-lectura, caso ancla y scorecard de proveedores · Gerente de Evolución

> **Modo:** Implementador. **Fecha:** 2026-07-14.
> **Verificación:** `build` ✅ · `lint` 0/0 ✅ · `vitest` **261/261** ✅ · QA en sesión `product_owner` real.
> Commits: **1.5a** (`4069862`) caso ancla + gate · **1.5b** scorecard de proveedores.

## Hallazgo que reorientó el alcance
Un mapeo del código (agente Explore) confirmó que **Problemas, Workflows y Vendors YA están
correctamente en solo-lectura**: cada control de mutación se oculta en UI tras el booleano de
permiso correcto y **cada server action revalida** el permiso. Un usuario `*.read` sin `*.manage`
ya obtiene una vista limpia sin botones de edición. Perms reales del rol:
`problem.read` (no manage) → Problemas read-only; `workflow.read` (no run/manage) → Workflows
read-only; `change.read + change.approve` → Cambios (aprueba CAB, no crea); `major_incident.manage`
→ MI accionable; `vendor.manage` → Vendors editable. **No requerían trabajo.** Los dos defectos
reales estaban en otra parte:

## 1.5a — Caso ancla read-only en el proyecto + gate de botones
1. **Link muerto del caso de origen.** El detalle de proyecto mostraba la incidencia de origen
   solo como link a `/incidents/[id]`, pero el Gerente de Evolución **no tiene `incident.read`**
   → el guard lo redirigía (callejón sin salida), violando **§0** (la mesa conserva el tracking y
   la comunicación con el cliente de extremo a extremo; la incidencia es el **ancla**).
   **Fix:** panel **read-only** del caso de origen que muestra estado, fechas y el **hilo de
   comunicación con el cliente** (`incident_comment` con `visibility='partner'`) vía
   `getAnchorCaseContext`. El deep-link a `/incidents` **solo** aparece si el usuario tiene
   `incident.read`. Así el rol ve el contexto y la conversación con el cliente sin gestionar casos.
2. **Botones de proyecto sin gate en UI.** Activar/completar/editar/cancelar y la gestión de
   tareas se renderizaban sin candado (dependían solo del server). **Fix:** gate por `project.manage`
   (`canManage`). Cierra la deuda de paridad (evita botones muertos para lectores de proyecto).

## 1.5b — Scorecard de proveedores
Vista **Scorecard** (toggle Lista | Scorecard en `/vendors`) con **señales objetivas por proveedor**,
todas de datos reales, vía RPC agregado **`vendor_scorecard()`** (`SECURITY DEFINER` + gate
`vendor.read` + scope tenant; solo agregados, nunca filas). Señales: criticidad, estado, **sistemas
provistos** (CMDB `configuration_item`), **incidencias abiertas** y **de 90d** sobre esos sistemas,
**alertas de monitoreo abiertas** (`monitoring_alert.resolved_at is null`), **disputas abiertas**
(`dispute_case`), y **días a vencimiento** de contrato. Orden por criticidad y luego incidencias
abiertas. Sin score "caja negra": se muestran las señales crudas (explicable). Tinte de atención
(incidencias/alertas → ámbar; disputas/vencido → rojo).

## Seguridad / QA (sesión `product_owner` real)
| Prueba | Resultado |
|---|---|
| Caso ancla + hilo cliente visibles bajo RLS | ✅ 1 proyecto con ancla, 1 incidencia, 1 comentario partner |
| `vendor_scorecard()` con datos | ✅ 3 proveedores (p.ej. Prisma: 5 sistemas, 5 incid. abiertas, 2 alertas, vence 170d) |
| Gate `vendor.read` en el RPC | por diseño `42501` a quien no lo tenga (mismo patrón que 1.3) |

## Archivos
**1.5a:** `lib/projects/queries.ts` (`getAnchorCaseContext`), `app/(app)/projects/[id]/page.tsx`,
`components/projects/project-detail.tsx`, `lib/i18n/dictionaries.ts`.
**1.5b:** `sql/0095_vendor_scorecard.sql` (aplicada), `lib/vendors/queries.ts` (`getVendorScorecard`),
`app/(app)/vendors/page.tsx`, `components/vendors/vendor-list.tsx`, `lib/i18n/dictionaries.ts`.

## Cierre de la Fase Evolución (1.1–1.5)
- **1.1** Segregación RBAC + gobierno de la derivación.
- **1.2** Navegación de persona (4 bloques) + incidentes mayores accionables.
- **1.3** Análisis de comportamiento (agregado, proactivo, causa-raíz).
- **1.4** Portafolio (WSJF desglosado, ROI real vs estimado, roadmap, capacidad).
- **1.5** Solo-lectura (verificado), caso ancla read-only, scorecard de proveedores.

Pendientes menores registrados: endurecer RLS de fila de `incident` (capa de app hoy); proyección
por-dimensión en 1.3; capturar actuals desde el detalle además del editar; umbrales de señales en datos.
