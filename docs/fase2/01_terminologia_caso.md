# Fase 2 · Terminología — "Incidente" → "Caso" (pantallas)

**Decisión del arquitecto:** en las pantallas, el término visible **"incidente" se renombra a
"Caso"** (alinea con User First / cero jerga ITSM: "tu caso"). **Excepción:** **"incidente mayor"
se conserva** (término ITIL de crisis; módulo de major incidents).

## Alcance del cambio (HECHO)
- **Solo texto visible en español** (valores del diccionario i18n `lib/i18n/dictionaries.ts`).
- **NO se tocó:** claves i18n, identificadores de código, tabla/columna `incident`, permisos
  (`incident.read/create/...`), ni el **bloque EN** (sigue diciendo "Incident").
- Los usos de "incidente" en **componentes** eran todos **comentarios** de código → no se cambiaron
  (el copy visible vive en el diccionario, §11).
- Verificado que no se corrompieron substrings ("coincidan", "coincidencias" intactas).

## Ejemplos de renombrado (ES)
`nav.incidents` → "Casos" · `inc.title` → "Gestión de casos" · `inc.new` → "Nuevo caso" ·
`wf.entity.incident` → "Caso" · `chg.origin.incident` → "Caso" · analítica/workload/vendors →
"Casos abiertos".
**Conservado:** `nav.majorincidents` → "Incidentes mayores", `mi.*` → "incidente mayor".

## Nota / pendiente
- **Idioma inglés no modificado** (el pedido fue en español). Si se desea consistencia bilingüe,
  actualizar los valores EN "Incident"→"Case" con cuidado (varias **claves** contienen "incident",
  requiere reemplazo solo en valores).
- El cambio alcanza también **pantallas de staff/ITSM** (módulo de casos, cambios, workflows,
  proveedores, analítica). Es lo pedido ("en la aplicación"); revisable si se prefiere acotar a las
  superficies del usuario final.

**Verificación:** `npm run build` ✅ · `vitest` 246/246 ✅.
