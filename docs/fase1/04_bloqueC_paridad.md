# Sub-Fase 1.2 · Bloque C — Mis Casos + Detalle de caso propio (P2) + CSAT (P4) · paridad

> **Modo:** Implementador (plan aprobado: RPC seguro + cierre al enviar CSAT; dimensiones Resolución/Rapidez/Atención).
> **Fecha:** 2026-07-13.
> **Verificación (R7):** `npm run build` ✅ (ruta `/portal/cases/[id]` registrada) · `vitest` **246/246** ✅ · RPCs + columnas verificadas en BD viva.

---

## 1. Archivos creados / modificados

| Archivo | Cambio |
|---|---|
| `sql/0085_case_survey_dimensions.sql` | **NUEVO (aplicado)** · columnas `q_resolution/q_speed/q_attention` (smallint, CHECK 1–5). |
| `sql/0086_my_case_rpc.sql` | **NUEVO (aplicado)** · RPCs SECURITY DEFINER: `get_my_case`, `get_my_case_thread`, `add_my_case_comment`, `submit_case_csat`. |
| `lib/portal/case-queries.ts` | **NUEVO** · `getMyCase`, `getMyCaseThread`, `getMyCaseSurvey`. |
| `lib/portal/case-actions.ts` | **NUEVO** · `addMyCaseComment`, `submitCaseCsat`. |
| `components/portal/case-csat.tsx` | **NUEVO** · CSAT simple (1–5 × 3 dims + comentario), vista de solo-lectura si ya enviada. |
| `components/portal/user-case-detail.tsx` | **NUEVO** · detalle propio: SLA ring, stepper, hilo, responder, CSAT. |
| `app/(app)/portal/cases/[id]/page.tsx` | **NUEVO** · ruta bajo `/portal` (sin `incident.read`); propiedad impuesta por RPC. |
| `components/portal/portal.tsx` | "Mis casos" ahora **clicable** → `/portal/cases/[id]` (fix UX-008). |
| `lib/i18n/dictionaries.ts` | +26 claves ES/EN (`case.*`, `case.csat.*`). |

---

## 2. Decisiones aplicadas (P1/P2/P4)

- **P2 — Detalle de caso propio (seguro por diseño):** en vez de abrir la RLS de `incident` (rompería la búsqueda de deflection del portal y expondría PII de terceros), se usan **RPCs SECURITY DEFINER** que **exigen `reported_by_user_id = current_account_id()`** y devuelven **solo campos seguros**; el hilo excluye comentarios **internos** (`visibility='internal'`). Componente **dedicado** (no la vista de agente).
- **P1 — Unificar:** el Hub enlaza al detalle propio; una sola verdad de "mis casos". *(La lista de `/partner`, con scoping por `affected_party_id`, se deja intacta en este bloque — su unificación se evalúa aparte por usar otro criterio; anotado.)*
- **P4 — CSAT (tu especificación):** 3 dimensiones (**Resolución, Rapidez, Atención**) 1–5 + comentario; **1:1**; **al enviar, cierra el caso** (`submit_case_csat`, auditado por el trigger de `incident`). Puntaje general = promedio.

---

## 3. Matriz de paridad — Áreas D (Mis Casos) y E (Detalle) + hallazgos

| ID | Funcionalidad | Estado | Nota |
|---|---|---|---|
| A-19 / D-01 | Filas "Mis casos" no clicables | **MEJORADA** | Ahora abren el **detalle propio** (fix **UX-008**). |
| E-01 | Detalle de caso para el usuario | **MEJORADA (nuevo)** | Vista propia dedicada (antes **inaccesible**; no reusa la de agente). |
| E-05 / UX-006 | CSAT del usuario | **MEJORADA (nuevo)** | Antes permiso **huérfano**; ahora superficie real (3 dims + comentario). |
| — | Hilo de comunicación del usuario | **MEJORADA (nuevo)** | Solo mensajes **no internos**; responder al hilo. Cumple §0 (tracking client-centric). |
| — | Caso en evolución | **MEJORADA (nuevo)** | Banner "tu caso evolucionó — seguimos contigo" (§0; no se muestra como cerrado). |

**Cero filas EN RIESGO.**

---

## 4. Preservación de otros roles (R1)

- **Vista de agente `/incidents/[id]` y su `CsatPanel`:** **NO modificados.** El agente sigue viendo/usando su CSAT de puntaje único (`score`); las nuevas columnas de dimensión son aditivas y nullable → sin impacto.
- **RLS de `incident`/`incident_comment`:** **sin cambios** (deflection y vistas de agente intactas). El aislamiento del usuario se logra por RPC, no restringiendo la tabla.
- **`submitCsat` de agente (lib/csat):** intacto; coexiste con `submit_case_csat` del usuario.

---

## 5. Disciplina HECHO / INTERPRETACIÓN / HIPÓTESIS

- **HECHO:** build ✅, 246 tests ✅. RPCs ejecutan sin error; 3 columnas de dimensión presentes; proyección `get_my_case` devuelve la fila correcta para un reportante real; filtro de visibilidad correcto.
- **INTERPRETACIÓN:** el owner-check en RPC + la exclusión de comentarios internos cubren la exposición; el cierre al enviar CSAT queda auditado por el trigger de `incident`.
- **HIPÓTESIS / limitación de verificación:** el flujo autenticado end-to-end (enviar CSAT → cierre; responder hilo) **no se ejerció vía MCP** (rol elevado, bypass de RLS/auth) y **no se mutó producción** a propósito. Se validó la lógica de lectura con datos reales. **Recomendación: QA con sesión `partner_user`** (crear caso → resolver como agente → usuario responde y evalúa → verificar cierre).

---

**STOP — ESPERANDO APROBACIÓN.**

Cambios **sin commitear** (2 migraciones ya aplicadas a la BD viva + código). ¿**Commit del Bloque C** y avanzo al **Bloque D (Base de Conocimiento como Knowledge Management real + Asistente IA)** — que incorpora tu dirección de KM más amplia y estructurada en contexto fintech?
