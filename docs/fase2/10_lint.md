# Fase 2 · Script `lint` reparado (Next 16 removió `next lint`)

**Problema:** `npm run lint` (`next lint`) fallaba — Next 16 eliminó el subcomando `lint`; y
`eslint .` con el `eslint.config.mjs` basado en FlatCompat + eslint-config-next lanzaba
`Converting circular structure to JSON` (bug conocido de esa combinación).

**Fix:**
- `package.json`: `"lint": "eslint ."`.
- `eslint.config.mjs`: flat config (ESLint 9) **compuesto directamente** sin FlatCompat —
  `typescript-eslint` + `@next/eslint-plugin-next` (recommended + core-web-vitals) + `react-hooks`
  (solo reglas clásicas `rules-of-hooks`/`exhaustive-deps`, evitando el preset moderno con reglas
  experimentales que marcarían código legacy). `no-explicit-any` off; `no-unused-vars` como warn.
- **2 errores preexistentes corregidos** (nunca detectados porque el script estaba roto):
  `no-unused-expressions` en `sidebar.tsx` e `incident-table.tsx` (ternario con efecto colateral →
  `if/else`, mismo comportamiento).

**Limpieza de warnings legacy (a pedido):** además de los 2 errores, se resolvieron los **10
warnings** pre-existentes para dejar el lint totalmente limpio:
- Imports/vars sin usar eliminados: `cmdb-list` (Link), `md-form`/`squad-list` (MessageKey),
  `product-channel-matrix` (useState), `sla/events-tab` y `worklog/work-log` (locale),
  `analytics/performance-tab` (eff).
- `exhaustive-deps`: `catalog-grid` (catName movido dentro del useMemo), `incident-table`
  (`now` = `Date.now()` sin useMemo), `filters` (directiva `eslint-disable` obsoleta eliminada).

**Resultado:** `npm run lint` → **0 errores, 0 warnings** (exit 0).

**Verificación:** `lint` ✅ (0/0) · `build` ✅ · `vitest` **250/250** ✅. Cambios preservan comportamiento.
