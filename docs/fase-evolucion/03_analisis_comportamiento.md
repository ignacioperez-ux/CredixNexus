# Sub-Fase 1.3 — Vista "Análisis de comportamiento" (agregado, proactivo)

> **Modo:** Implementador (aprobado: página dedicada + alcance completo). **Fecha:** 2026-07-14.
> **Verificación:** `build` ✅ · `lint` 0/0 ✅ · `vitest` **254/254** ✅ · QA en sesión real (positiva y negativa).

## Qué es
Pantalla `/analytics/comportamiento` para que Evolución analice el **comportamiento agregado de
casos (nunca casos individuales)** por dimensión de negocio y decida proactivamente cuándo abrir un
esfuerzo mayor de **causa-raíz**, complementando lo que ya sugiere la IA.

## Capa de datos — RPC `incident_behavior_analysis(dimension, semanas)` (migración `0093`)
- **`SECURITY DEFINER`** + verificación explícita **`has_permission('analytics.read')`** +
  scope **`current_tenant_id()`**. Devuelve **solo agregados**, jamás filas de casos → refuerza la
  segregación (product_owner no tiene `incident.read`) aun si la RLS de fila se endureciera luego.
- **Sin SQL dinámico:** la dimensión se resuelve por *whitelist* con `CASE` (no inyectable).
- **7 dimensiones reales** (FK verificadas): Categoría (`incident_category`), Producto (`product`),
  Sistema (`service`), Área de negocio (`business_unit`), Canal (`channel`), Proceso (`process`),
  Prioridad (enum). Etiquetas descriptivas por join a maestros — **nombre, no UUID** (§10.3).
- **Por grupo:** volumen, abiertos, resueltos, MTTR, SLA vencido, candidatos a transformación,
  score promedio, impacto financiero, partners/transacciones, casos con problema vinculado y
  **momentum** (recientes − anteriores en la ventana).
- **Tendencia** semanal + **proyección transparente** (`regr_slope`/`regr_intercept`, lineal,
  etiquetada como tal — sin "AI theater").
- **Señales de causa-raíz:** grupos con volumen relevante (≥3) + momentum al alza + señal de
  transformación + **sin problema vinculado** (`problem_incident`). Explicable; la decisión es humana.

## UI — `components/analytics/behavior-analysis.tsx`
Selector de dimensión (7) + ventana (4/8/12/26/52 sem) por URL (`?dim=&weeks=`) → re-fetch en
servidor con dato real (nada mockeado en cliente). KPIs, ranking por dimensión (barras + badges),
tendencia con proyección (guion), **panel de señales de causa-raíz** (centro proactivo) y tabla de
detalle (accesibilidad: no solo color; momentum con flecha + etiqueta). Tokens y patrón visual del
design system (reusa el lenguaje de `exec-dashboard`). i18n ES/EN completo (`beh.*`).

## Navegación / paridad
Nuevo item **`nav.behavior` → `/analytics/comportamiento`** en la categoría `Analítica` de
MACRO_NAV (perm `[incident.read, analytics.read]`) → **disponible para todos los roles de
analítica** (paridad R1, no es exclusivo del rol). En el overlay del Gerente de Evolución encabeza
el bloque **Gobierno y análisis**. Gate de ruta cubierto por el prefijo `/analytics` existente.

## QA
| Prueba | Resultado |
|---|---|
| `product_owner` (con `analytics.read`) → agregados | ✅ 20 casos, 13 grupos, 12 tendencia, proyección, 1 señal |
| 6 dimensiones (priority/process/service/business_unit/channel/product) | ✅ todas bien formadas |
| Usuario **sin** `analytics.read` → RPC | ✅ **`42501 forbidden`** (rechazado en la BD) |

## Archivos
- `sql/0093_incident_behavior_analysis.sql` (aplicada)
- `lib/analytics/queries.ts` — tipos + `getBehaviorAnalysis` + `normalizeDimension` + `BEHAVIOR_DIMENSIONS`
- `app/(app)/analytics/comportamiento/page.tsx` — server (searchParams → RPC)
- `components/analytics/behavior-analysis.tsx` — vista cliente (charts + señales)
- `lib/i18n/dictionaries.ts` — `beh.*` + `nav.behavior` (ES/EN)
- `lib/nav/navigation.ts` — item `nav.behavior` en Analítica + en overlay Gobierno

## Pendiente (sub-fases siguientes)
- 1.4 Portafolio (WSJF, ROI real vs estimado, roadmap, capacidad) + Squads & Talento.
- 1.5 Restricciones read-only en detalle de caso/problemas/MI/workflows + scorecard proveedores.
- Refinamiento posible: proyección por-dimensión (hoy la proyección es de volumen total); señales
  con umbral configurable en datos (hoy 3 / 0.5 en la función).
