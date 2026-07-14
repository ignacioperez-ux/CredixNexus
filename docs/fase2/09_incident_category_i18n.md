# Fase 2 · i18n del maestro `incident_category` (portal)

**Problema:** las categorías del portal ("Explora por categoría", `incident_category.name`) estaban
solo en español; en modo EN se veían en español.

**Fix (análogo a UX-010):** `sql/0089_incident_category_i18n.sql` (aplicada) agrega `name_en` y
traduce las **16 categorías** por `code`. El portal muestra la etiqueta **localizada**:
- `lib/portal/queries.ts`: `PortalCategory` + `listPortalCategories` incluyen `name_en`.
- `components/portal/portal.tsx`: helper `catLabel` (locale → `name_en`/`name`, fallback ES) en las
  tarjetas de categoría, el select y la inicial.

*(El uso interno en `portalAssist` conserva el nombre ES para el prompt de IA — no es UI.)*

**Verificación:** `npm run build` ✅ · `vitest` **250/250** ✅.
