# Sub-Fase 1.2 — Navegación de persona · Gerente de Evolución

> **Modo:** Implementador. **Fecha:** 2026-07-14.
> **Verificación:** `build` ✅ · `lint` 0/0 ✅ · `vitest` **254/254** ✅ (+4 nuevas).

## Qué cambió
El sidebar sigue siendo **global (MACRO_NAV)** para casi todos los roles. El **Gerente de
Evolución puro** recibe un **reagrupamiento de persona** (`EVOLUTION_NAV`) construido por
**referencia a los ids canónicos** de MACRO_NAV — mismos `path` y `perm`, **nada se elimina ni
se inventa** (§11 cero hardcode). `canSeeNav` sigue filtrando por permiso: el rol solo ve lo que
puede abrir. Un multi-rol operativo/admin (p.ej. product_owner + support_agent) conserva MACRO_NAV.

### Los cuatro bloques (EVOLUTION_NAV)
| Bloque | Items (rutas reales) | Nota |
|---|---|---|
| **Evolución** | Portafolio `/projects` · Squads `/squads` · Capacidad `/workload` · Talento `/talent` · Proveedores `/vendors` | El trabajo del squad. Auto-expandido. |
| **Gobierno y análisis** | Análisis `/analytics` · AI Center `/ai-center` · Motor de reglas `/rules` · Workflows `/workflows` · Arquitectura `/processes` · Conocimiento `/knowledge` | Motor, IA y **análisis proactivo** (aloja la vista de comportamiento, 1.3). Auto-expandido. |
| **Casos y coordinación** | Incidentes mayores `/major-incidents` **(accionable)** · Problemas `/problems` `[solo lectura]` · Cambios/CAB `/changes` `[solo lectura]` | Ver §Ajuste. |
| **Ayuda** | Catálogo `/service-catalog` · Autoservicio `/portal` | Mis solicitudes, como cualquier usuario. |

## Ajuste por instrucción del arquitecto (mitad de sesión)
1. **Incidentes mayores = accionables por ambas áreas.** Migración **`0092`** concede
   `major_incident.manage` a `product_owner` (antes solo `major_incident.read`). En el nav va
   **sin** badge de solo-lectura. **No** altera la segregación de casos individuales.
2. **Casos NO derivados = intocables.** Ya garantizado por 1.1 (sin `incident.read`/`update`):
   el rol no ve `/incidents`, `/workspace`, `/dashboard`, `/customers` ni puede mutar casos.
3. **Solo lectura visible.** Problemas y Cambios llevan badge `Solo lectura` (candado) en el
   sidebar: el rol lee/vincula pero no edita (no tiene `problem.manage`/`change.manage`).

## Hallazgo de seguridad (documentado, no corregido aquí)
La RLS de `incident` (`incident_isolation`) filtra **solo por `tenant_id`**, no por `incident.read`.
La segregación de casos individuales es **capa de aplicación** (nav + guard de ruta + gate de
server actions), no de fila. Endurecer la RLS a nivel fila afectaría a todos los roles/flujos y es
un cambio mayor → se evalúa aparte. Para la vista de análisis (1.3) es **irrelevante**: se sirve
por RPC **agregado** que nunca devuelve filas individuales.

## Archivos
- `sql/0092_evolution_major_incident.sql` (aplicada)
- `lib/nav/navigation.ts` — `readOnly` en `NavigationItem`; `EVOLUTION_NAV`, `buildRoleNav`, `navForRoles`
- `lib/nav/role-ux.ts` — emphasis del rol + guard acepta ids de persona
- `components/app-shell/sidebar.tsx` — `navForRoles`, categoría activa sobre árbol renderizado, badge
- `lib/i18n/dictionaries.ts` — `nav.ev.*`, `nav.readonly` (ES/EN)
- `lib/nav/navigation.test.ts` — +4 pruebas (integridad refs, i18n, read-only, `navForRoles`)

## Siguiente: 1.3 — Vista "Análisis de comportamiento" (agregado, proactiva)
Ver diseño propuesto en el mensaje de entrega. **STOP** para aprobación: toca DB (RPC agregado)
+ UI (charts) → condición §2.4 (multicapa, exposición de datos).
