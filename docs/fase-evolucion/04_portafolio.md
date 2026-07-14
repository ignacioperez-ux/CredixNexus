# Sub-Fase 1.4 — Portafolio (cockpit estratégico) · Gerente de Evolución

> **Modo:** Implementador. **Fecha:** 2026-07-14.
> **Verificación:** `build` ✅ · `lint` 0/0 ✅ · `vitest` **261/261** ✅ (+7) · QA en sesión `product_owner` real.

## Qué es
Nueva pantalla `/projects/portafolio`: la vista estratégica del portafolio de evolución, con las
cuatro capacidades pedidas — **WSJF desglosado**, **ROI estimado vs real**, **roadmap** y
**capacidad prospectiva por squad**. El tablero (kanban) sigue siendo la vista operativa; el
Portafolio es la de decisión. Ambos enlazados.

## WSJF desglosado
La barra por proyecto muestra el **numerador segmentado** (valor + criticidad + reducción de
riesgo), el **tamaño** (denominador) y el **WSJF** resultante. Orden por WSJF desc. Los componentes
ya existían en `project` (`business_value`, `time_criticality`, `risk_reduction`, `job_size`, `wsjf`
generado); antes solo se veía el número final.

## ROI estimado vs real
- **Nuevas columnas** (migración `0094`): `actual_benefit_amount`, `actual_cost_amount` (nullable
  + CHECK no negativo). ROI real = `(beneficio_real − costo_real) / costo_real`.
- **Captura** con integridad (§10): tarjeta "Resultados reales" en el **editar proyecto** (validación
  servidor `optNonNeg`, null explícito si no se mide), ROI real calculado en vivo.
- **Portafolio:** tabla por proyecto (estimado · real · Δ) + KPIs de ROI estimado y real de todo el
  portafolio (`portfolioRoi`), con conteo `medidos/total`. Estado vacío honesto si aún no hay actuals.

## Roadmap
Gantt-lite sobre eje de meses: **ventana planificada** (barra, `planned_start`/`planned_end`) y
**ejecución real** (línea inferior, `actual_start`/`actual_end`). Sin fechas → estado vacío.

## Capacidad prospectiva por squad
Demanda comprometida = suma de `job_size` de proyectos **abiertos** (`proposed/approved/on_hold/active`)
por squad, frente a `squad.capacity_points`. Barra de carga %; **sobrecarga** (>100%) marcada en rojo.
Lógica pura testeada (`squadLoads`, división por cero → `null`).

## Navegación / paridad
Nuevo item **`nav.portfolio` → `/projects/portafolio`** en la categoría `Evolución` de MACRO_NAV
(perm `project.read`) → disponible para todos los roles con acceso a proyectos (paridad R1). En el
overlay del Gerente de Evolución va en el bloque **Evolución**, junto a Portafolio/Squads/Talento.
Cross-link desde el tablero. Gate de ruta cubierto por el prefijo `/projects` existente.

## Archivos
- `sql/0094_project_actuals.sql` (aplicada) — `actual_benefit_amount`, `actual_cost_amount` + checks
- `lib/projects/actions.ts` — `ProjectInput` + validación + `actualCols` en `updateProject`
- `lib/projects/queries.ts` — `PortfolioRow`, `listPortfolio`, `SquadCapacity`, `listSquadCapacity`
- `lib/projects/portfolio.ts` (+ `.test.ts`) — `portfolioRoi`, `squadLoads`, `wsjfParts`, `isOpenProject`
- `components/projects/portfolio.tsx` — cockpit (WSJF · ROI · roadmap · capacidad)
- `components/projects/project-form.tsx` — tarjeta "Resultados reales" (solo edición)
- `components/projects/new-project-button.tsx` — `PortfolioLink`
- `app/(app)/projects/portafolio/page.tsx` — página server
- `app/(app)/projects/page.tsx`, `.../[id]/edit/page.tsx` — cross-link + initial actuals
- `lib/i18n/dictionaries.ts` — `port.*`, `proj.actuals*`, `nav.portfolio` (ES/EN)
- `lib/nav/navigation.ts` — item `nav.portfolio` en Evolución (macro + overlay)

## QA (sesión `product_owner` real)
| Métrica | Valor |
|---|---|
| Proyectos visibles (RLS) | 5 |
| Squads activos | 5 |
| Puntos comprometidos (job_size abiertos) | 28 |
| Proyectos con actuals | 0 (estado vacío honesto; se capturan en edición) |

## Pendiente (siguientes)
- 1.5 — Restricciones read-only en detalle de caso/problemas/MI/workflows + scorecard proveedores.
- Refinamiento posible: capturar actuals también en el detalle (no solo en editar); histórico de ROI.
