# Sub-Fase 1.2 · Bloque A — Tokens base + Inicio (Hub) · reporte de paridad

> **Modo:** Implementador (sobre plan aprobado 1.1).
> **Alcance del bloque:** tokens/design system base + rediseño de `/portal` como **Hub del hilo**.
> **Fecha:** 2026-07-13.
> **Verificación (R7):** `npm run build` ✅ · `vitest` **246/246** ✅ · lint: ver nota.

---

## 1. Archivos modificados / creados

| Archivo | Cambio | Riesgo |
|---|---|---|
| `app/globals.css` | **Delta aditivo** de tokens (escala tipográfica, espaciado 8pt, motion `--t-base/--t-slow`, data-viz, `--sh-float`). Corrección del comentario de cabecera ("lima" → realidad). **No** se alteró ningún valor de color ni `--t-fast`. | Bajo (aditivo) |
| `components/portal/hub-viz.tsx` | **NUEVO** · `SlaRing` (anillo SLA vivo) + `StatusDonut` (donut de casos por estado). Dedicado al Hub. | Bajo (nuevo, no compartido) |
| `components/portal/portal.tsx` | Rediseño a Hub: banda "Tu resumen" (donut + stat tiles), anillos SLA en "Mis casos", tokens de escala. **Toda la funcionalidad previa conservada.** | Bajo (componente dedicado del rol) |
| `lib/portal/queries.ts` | `MyCase` extendido con `priority, sla_resolution_due_at, first_response_at, resolved_at` (datos reales). | Bajo (dedicado al portal) |
| `lib/i18n/dictionaries.ts` | +4 claves ES/EN (`portal.donut.title`, `portal.summary.inprogress/resolved/attention`). | Bajo (aditivo) |
| `CLAUDE.md` §11 | Aclaración de marca (rojo Credix = verdad; teal/lima = dato secundario; Claro default del portal Usuario) — **por decisión explícita del arquitecto**. | Doc |

---

## 2. Matriz de paridad — Área A (Inicio / Hub)

Estado: **PRESERVADA** (igual función, mejor presentación) · **MEJORADA** (función ampliada) · **EN RIESGO** (posible pérdida). **Cero filas EN RIESGO.**

| ID | Funcionalidad | Estado | Nota |
|---|---|---|---|
| A-01 | Hero de bienvenida (nombre + casos en curso) | **PRESERVADA** | Ahora usa tokens de escala tipográfica. |
| A-02 | Mensaje de éxito "caso creado {nº}" | **PRESERVADA** | Idéntico. |
| A-03 | Explorar por categoría (chips → intake) | **PRESERVADA** | Idéntico. |
| A-04 | Intake: asunto (mín. 8) | **PRESERVADA** | — |
| A-05 | Intake: aplicación afectada | **PRESERVADA** | — |
| A-06 | Intake: categoría (auto-IA) | **PRESERVADA** | — |
| A-07 | Intake: urgencia | **PRESERVADA** | — |
| A-08 | "Consultar" (portalAssist IA + deflection) | **PRESERVADA** | Lógica intacta. |
| A-09 | "Registrar caso" (createIncident + recordKbEvent) | **PRESERVADA** | Lógica intacta. |
| A-10 | Estados de carga (Buscando/Creando) | **PRESERVADA** | — |
| A-11 | Errores de campo/global (`err.*`) | **PRESERVADA** | — |
| A-12 | Guía IA + confianza % | **PRESERVADA** | — |
| A-13 | Aviso "IA no configurada" (R3) | **PRESERVADA** | Degradación honesta intacta. |
| A-14 | Tarjetas KB (leer/ocultar + feedback) | **PRESERVADA** | `KbCard` intacto. |
| A-15 | Casos resueltos similares | **PRESERVADA** | Enlace condicionado a `canViewIncidents` intacto. |
| A-16 | Estados vacíos de sugerencias | **PRESERVADA** | — |
| A-17 | "Mis casos" (lista) | **MEJORADA** | + **anillo SLA vivo** (real), + **pill de estado** (color+dot+etiqueta), + **orden por urgencia** (abiertos y SLA próximo arriba). |
| A-18 | "Mis casos" vacío | **PRESERVADA** | — |
| A-19 | Filas no clicables sin `incident.read` | **PRESERVADA** | Se mantiene (sin acción falsa, R3). Drill-down real llega con **P2 (Bloque E)**. |
| **A-NEW-1** | **Donut de casos por estado** | **MEJORADA (nuevo)** | Sustituye contadores planos (UX-012); status colors con leyenda etiquetada. |
| **A-NEW-2** | **Stat tiles** (En curso / Resueltos / Requieren seguimiento) | **MEJORADA (nuevo)** | KPI con tono de alerta e ícono cuando aplica. |

---

## 3. Cumplimiento de reglas

- **R1 (paridad):** ninguna funcionalidad eliminada/oculta/degradada. Verificado fila por fila (§2).
- **R2 (cero hardcode):** el donut se computa de conteos reales de `myCases`; el anillo SLA de `opened_at`/`sla_resolution_due_at`/`resolved_at` reales. Si no hay SLA, degrada a "Sin SLA" (no inventa). **HECHO:** columnas verificadas en el esquema vivo.
- **R3 (sin AI theater):** no se añadió IA simulada. Las filas sin detalle no ganan acciones falsas.
- **R8 (accesibilidad):** color de estado con **triple señal** (color+ícono/dot+etiqueta+gap 2px), validado con la guía de dataviz (par ámbar/amarillo nunca por hue solo). Motion respeta `prefers-reduced-motion` (existente).
- **R9 (español):** todo copy nuevo vía i18n ES/EN.
- **§3.2 #2:** build corrido y verde antes de cerrar. **Sin commit** (pendiente de tu aprobación).

---

## 4. Disciplina HECHO / INTERPRETACIÓN / HIPÓTESIS

- **HECHO:** build ✅, 246 tests ✅. Columnas SLA/priority existen en `incident`. Componente `portal.tsx` es dedicado del rol (no compartido) → riesgo bajo. `statusColors`/`statusKey` reutilizados (no duplicados).
- **INTERPRETACIÓN:** el mapeo estado→color del donut/pill espeja `statusColors` existente (fuente única).
- **HIPÓTESIS:** que los casos-semilla del usuario demo tengan `sla_resolution_due_at` poblado; si no, el anillo muestra "Sin SLA" correctamente (no bloquea).

---

## 5. Diferido (con justificación)

1. **Tema Claro por defecto del portal Usuario:** NO implementado en Bloque A. `theme-provider` es **compartido** (afecta a todos los roles) y su default global es `nexus`; forzar Claro por rol/ruta es un cambio de superficie compartida → **STOP propio**. El Hub se diseñó para verse bien en **ambos** temas. Se propone abordarlo como ítem específico.
2. **"Requiere tu atención" accionable:** en Bloque A se surface vía stat tile "Requieren seguimiento" + orden por urgencia + anillo SLA. La **acción** (abrir/responder) depende del **detalle de caso propio (P2, Bloque E)**.
3. **`npm run lint` roto (pre-existente):** `next lint` quedó deprecado en Next 16 (`Invalid project directory … /lint`). ESLint corre dentro de `next build` (verde). Recomendación: migrar el script a ESLint CLI en un cambio aparte.

---

**STOP — ESPERANDO APROBACIÓN.**

No inicio el **Bloque B (Catálogo + Formularios de solicitud)** hasta tu aprobación. Recordatorio: Catálogo/solicitudes son **componentes compartidos** con Agente/Admin → el Bloque B abrirá con un STOP de alcance para no degradar esos roles (R1).
