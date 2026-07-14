# Sub-Fase 1.3 — Cierre de Fase 1 · Rediseño experiencia rol Usuario

> **Fecha:** 2026-07-13 · **Rama:** main.
> **Criterio de cierre:** matriz de paridad 100% en PRESERVADA/MEJORADA (cualquier EN RIESGO bloquea). **Resultado: 0 filas EN RIESGO.**

---

## 1. Resumen de la fase

Rediseño de la experiencia del rol **Usuario** (`partner_user`) por sub-fases con compuertas. Entregables en `docs/fase1/`: `00_inventario_paridad`, `01_sistema_visual_y_concepto`, `02`–`05` (paridad por bloque), y este cierre.

| Bloque | Alcance | Commit |
|---|---|---|
| A | Tokens base + Hub (Inicio) | `9563bbc` |
| B | Catálogo/Solicitudes + fix seguridad P3 (RLS 0084) | `f234600` |
| C | Detalle de caso propio (P2) + CSAT por dimensiones (P4) — migraciones 0085/0086 | `d585b45` |
| D | Knowledge Management real + render Markdown | `634a32c` |

**Migraciones aplicadas a la BD viva** (audit-grade): `0084` (RLS por propietario en `service_request` + `current_account_id()`), `0085` (dimensiones CSAT), `0086` (RPCs seguras de caso propio + cierre al enviar CSAT).

---

## 2. Matriz de paridad final (consolidada)

**Cero filas EN RIESGO.** Toda funcionalidad del inventario está PRESERVADA o MEJORADA.

| Área | Resultado | Evidencia |
|---|---|---|
| **A. Inicio / Hub** | MEJORADA | Donut de estado, anillos SLA, stat tiles; toda función previa preservada (`02_bloqueA`). |
| **B. Catálogo** | MEJORADA | Buscador + chip SLA; grid preservado (`03_bloqueB`). |
| **C. Formularios de solicitud** | MEJORADA | Chip explicativo de SLA; validación/RPC intactas. |
| **D. Mis Casos** | MEJORADA | Unificado y **clicable** → detalle propio; scoping por propietario. |
| **E. Detalle de caso** | MEJORADA (nuevo) | Vista propia del usuario (hilo/SLA/stepper/CSAT); antes inaccesible. |
| **F. Base de Conocimiento** | MEJORADA | Descubrimiento visual + Markdown real; curador preservado (`05_bloqueD`). |
| **G. Aprobaciones** | N/A honesto | No existe para el rol; no se fabrica. |
| **H. Asistente IA** | PRESERVADA + acceso nuevo en KB | `portalAssist` intacto; degradación honesta (R3). |
| **Chrome compartido** | PRESERVADO | Header/sidebar/command-menu sin degradar otros roles (R1). |

---

## 3. Verificación R2 (muestreo UI ↔ BD viva, 2026-07-13)

Los valores visibles provienen de queries reales (cero hardcode):

| Valor UI | Fuente real | Muestra |
|---|---|---|
| Ítems del catálogo | `service_item` (active) | **8** |
| SLA por ítem (chip) | `service_item.sla_hours` | rango **4–48h** |
| Artículos KB (descubrimiento) | `knowledge_article` (active) | **9** |
| Tarjetas de categoría KB | `distinct category` | **4** |
| Chips de tipo KB | `distinct article_type` | **2** |
| "Explora por categoría" (portal) | `incident_category` (active) | **16** |
| Anillos SLA de casos | `incident.sla_resolution_due_at` | **18** con SLA |
| "Mis solicitudes" | `service_request` (owner-scoped) | **1** total |
| Encuestas CSAT | `case_survey` | **4** |

---

## 4. Registro de hallazgos UX (estado al cierre)

| ID | Estado | Nota |
|---|---|---|
| UX-001 | ✅ **Cerrado** | KB del usuario sin métricas de ops (Bloque D). |
| UX-002 | ✅ **Cerrado** | "Mis solicitudes" propias (app + RLS 0084). |
| UX-003 | ✅ **Cerrado** | Owner-check en detalle de solicitud (+ RLS). |
| UX-004 | ✅ **Cerrado** | Enlace caso ancla condicionado a `incident.read`. |
| UX-006 | ✅ **Cerrado** | CSAT del usuario (Bloque C). |
| UX-008 | ✅ **Cerrado** | Detalle de caso propio + "mis casos" clicable. |
| UX-012 | ✅ **Cerrado** | Data-viz en el Hub. |
| UX-013 | ✅ **Cerrado** | Render Markdown ampliado. |
| UX-007 | 🟡 **Parcial** | Hub unificado; `/partner` (scoping por `affected_party_id`) **no** unificado — decisión aparte. |
| UX-011 | 🟡 **Parcial** | Intake del portal aún fija `impact:"medium"` sin explicar la prioridad (pendiente). |
| **UX-005** | 🔴 **Abierto** | Command Menu ofrece "Nuevo incidente" → `/incidents/new` (gateado por `incident.read`) → `/unauthorized` para el usuario. **Recomendado corregir pronto** (apuntar el "nuevo caso" del usuario a `/portal` o filtrar la quick-action). |
| UX-018 | 🔴 Abierto | Asimetría `incident.create` vs `incident.read` en el chrome (relacionado con UX-005). |
| UX-009 | 🔴 Abierto | Persona `/portal` (interno) vs `/partner` (externo) — decisión de producto. |
| UX-010 | 🔴 Abierto | Categorías/labels de catálogo en crudo (i18n de datos maestros). |
| UX-014/015/016/017/019 | 🔴 Abierto | Deuda menor de design system / roles (ver inventario §7). |

---

## 5. Deuda nueva y recomendaciones para Fase 2

1. **UX-005 (prioritario):** corregir el camino roto "Nuevo incidente" del Command Menu para el usuario final.
2. **Tema Claro por defecto del portal Usuario:** no aplicado (el `theme-provider` es compartido; requiere lógica por rol/ruta — STOP propio).
3. **Unificación de `/partner`** con el Hub (UX-007) — usa scoping distinto (`affected_party_id`); evaluar como pieza aparte.
4. **Taxonomía fintech de KB** (por producto/canal/sistema): recategorizar artículos = **datos maestros**, no código.
5. **CsatPanel de agente:** mostrar las nuevas dimensiones (hoy muestra solo el puntaje general) — mejora menor, opcional.
6. **Script `lint` roto:** `next lint` quedó deprecado en Next 16; migrar a ESLint CLI.
7. **QA pendiente (no ejecutable vía MCP):**
   - RLS/RPC de caso propio con **sesión `partner_user`** real (crear → resolver → responder → evaluar → verificar cierre).
   - Render **Markdown** con artículos de contenido rico (tablas/código).
   - Efecto de la **RLS 0084** con usuario autenticado (el MCP corre con rol elevado que bypassa RLS).

---

## 6. Cumplimiento de reglas duras (fase completa)

- **R1 paridad:** 0 EN RIESGO; otros roles (Agente/Admin/Curador) preservados en cada bloque.
- **R2 cero hardcode:** verificado por muestreo (§3).
- **R3 sin AI theater:** IA con degradación honesta; contenedores honestos; aprobaciones no fabricadas.
- **R7:** validación por build + 246 tests (sin dev server).
- **R8 accesibilidad:** color de estado con triple señal (validado con dataviz); `prefers-reduced-motion` respetado.
- **R9 español:** todo copy nuevo en i18n ES/EN.
- **Audit-grade (§10/§11):** migraciones formales en `sql/`; RPCs SECURITY DEFINER con owner-check; mutaciones de caso auditadas por triggers.

---

**STOP — FASE 1 COMPLETA, ESPERANDO APROBACIÓN PARA FASE 2.**
