# Sub-Fase 1.2 · Bloque D — Knowledge Management real + Asistente IA · paridad

> **Modo:** Implementador (plan aprobado: bifurcar por rol + mejorar render Markdown).
> **Alcance:** Base de Conocimiento (Área F) + Aprobaciones (G, N/A) + Asistente IA (H).
> **Fecha:** 2026-07-13.
> **Verificación (R7):** `npm run build` ✅ · `vitest` **246/246** ✅.

---

## 1. Archivos creados / modificados

| Archivo | Cambio | Compartido |
|---|---|---|
| `components/knowledge/user-knowledge.tsx` | **NUEVO** · vista de descubrimiento del usuario (buscador, categorías reales, tipos, "más consultados"). | No |
| `app/(app)/knowledge/page.tsx` | Bifurca por rol: curador→`KbBrowser` (intacto); usuario→`UserKnowledge`. | Sí |
| `components/knowledge/article-view.tsx` | `showOps` oculta métricas de ops al usuario final; staff/curador las conserva. | Sí |
| `app/(app)/knowledge/[id]/page.tsx` | Calcula `showOps = canManage || incident.read` (staff). | Sí |
| `components/ai/ai-report.tsx` | Render Markdown ampliado **aditivo**: `#`..`####`, `[enlaces](url)`, `` `código` ``, bloques ```` ``` ````, tablas GFM, listas ordenadas. | Sí |
| `lib/i18n/dictionaries.ts` | +12 claves ES/EN (`ukb.*`). | Aditivo |

---

## 2. Decisiones aplicadas

- **KM real (dirección del arquitecto):** el usuario final deja de ver la **tabla de métricas de operación** (UX-001) y recibe una **experiencia de descubrimiento**: buscador *search-first*, **tarjetas de categoría** (campo real `category` + conteo), filtro por **tipo** (reales), y **"Más consultados"** (orden por `view_count`, sin exponer el número de ops). **Estructura por datos reales — cero taxonomía inventada (R2/§11).**
- **Render de contenido (UX-013):** `AiReport` ahora interpreta Markdown real (encabezados, enlaces, código en línea y en bloque, **tablas**, listas ordenadas) — de forma **aditiva**: el texto simple y las negritas/viñetas previas siguen igual.
- **Asistente IA (R3):** sin respuestas fabricadas. Se añade en KB un acceso honesto *"¿No encuentras lo que buscas? → describe tu caso"* que enlaza al intake del portal (`portalAssist`, que ya degrada sin IA).
- **Aprobaciones (G):** honestamente ausente para el rol; sin cambios (no se inventa bandeja).

---

## 3. Matriz de paridad — Áreas F / G / H

| ID | Funcionalidad | Estado | Nota |
|---|---|---|---|
| F-01/03 | Listado KB (tabla de ops para el usuario) | **MEJORADA** | Usuario → descubrimiento visual; **curador conserva la tabla** (bifurcado). |
| F-02 | KPIs de ops en el listado | **MEJORADA** | Ocultos al usuario (UX-001); intactos para el curador. |
| F-04 | Filtros/búsqueda | **MEJORADA** | Usuario: búsqueda + categoría + tipo; curador: filtros de tabla intactos. |
| F-05 | Estado vacío | **PRESERVADA** | + vacío de búsqueda del usuario. |
| F-06 | Contenido del artículo (Markdown) | **MEJORADA** | Enlaces, código, **tablas**, listas ordenadas (fix UX-013). |
| F-02/03b | Métricas de ops en el artículo | **MEJORADA** | Ocultas al usuario; staff (curador/agente) las conserva. |
| F-07 | Origen (problema/incidente ancla) | **PRESERVADA** | Sin cambios. |
| F-08 | Feedback "¿te fue útil?" | **PRESERVADA** | Intacto (permiso `knowledge.feedback`). |
| F-10 | Gestión (curador) | **PRESERVADA** | Solo `canManage`; intacto. |
| G-01 | Aprobaciones del usuario | **N/A honesto** | No existe para el rol; no se fabrica. |
| H-01/02 | Asistente IA (intake) | **PRESERVADA** | `portalAssist` intacto; degradación honesta. |
| H-nuevo | Acceso IA desde KB | **MEJORADA (nuevo)** | Enlace "describe tu caso" → intake. |

**Cero filas EN RIESGO.**

---

## 4. Preservación de otros roles (R1)

- **Curador/Admin:** `/knowledge` sigue mostrando `KbBrowser` (tabla de ops) **sin cambios**; artículo con métricas y gestión intactos.
- **Agente (`incident.read`):** conserva las métricas de ops del artículo (`showOps` incluye `incident.read`).
- **`AiReport` (usado en todo el app):** cambio **aditivo** — el texto simple, negritas y viñetas previas renderizan igual; solo se **añade** soporte para más sintaxis. Sin cambios de firma.

---

## 5. Disciplina HECHO / INTERPRETACIÓN / HIPÓTESIS

- **HECHO:** build ✅, 246 tests ✅. La vista de usuario usa solo datos reales de `getKb` (categorías/tipos/popularidad); métricas de ops ocultas por `showOps`.
- **INTERPRETACIÓN:** la detección de tablas GFM exige una fila separadora `---|---`, por lo que prosa con `|` no se convierte en tabla por accidente.
- **HIPÓTESIS / recomendación:** conviene **QA visual** del render Markdown en artículos con contenido rico (tablas/código) y de la vista de descubrimiento con sesión `partner_user`. Deuda anotada: una **taxonomía fintech más rica** (por producto/canal/sistema) requiere recategorizar artículos (datos maestros), no código.

---

**STOP — ESPERANDO APROBACIÓN.**

Con esto quedan cubiertos los cuatro bloques (A–D) de la Sub-Fase 1.2. ¿**Commit del Bloque D** y avanzo a la **Sub-Fase 1.3 (Cierre de Fase 1)** — matriz de paridad final, verificación R2 por muestreo, y registro de deuda/hallazgos (UX-xxx) para Fase 2?
