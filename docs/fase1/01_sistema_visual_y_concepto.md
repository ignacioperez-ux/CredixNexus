# Sub-Fase 1.1 — Sistema visual y concepto de experiencia · rol **Usuario**

> **Modo:** Arquitecto (diseño; **sin** código de producción).
> **Alcance:** experiencia del rol Usuario (`partner_user`). Base de verdad: inventario `00_inventario_paridad.md` + esquema vivo.
> **Insumos vinculantes:** decisiones de compuerta P1–P4 (§9.1 del inventario) + dirección del arquitecto (drill-down en todo · Knowledge Management real).
> **Fecha:** 2026-07-13.
> **Disciplina:** HECHO / INTERPRETACIÓN / HIPÓTESIS. R2 (cero hardcode), R3 (sin AI theater), R8 (WCAG AA), R9 (UI en español) se respetan en todo el concepto.

---

## 0. Cómo leer este documento

Este es un **concepto**, no una implementación. Cada decisión visual se ancla a **una** de tres palancas medibles:
**(C)** carga cognitiva · **(D)** descubribilidad · **(E)** emoción/confianza. Y cada pantalla se evalúa contra los **8 principios** del encargo. Los tokens propuestos (§9) están en formato implementable y serán el *delta* de `app/globals.css` en la Sub-Fase 1.2 Bloque A — aquí **no se aplican**.

---

## 1. Concepto rector — "**Un solo hilo, siempre visible**"

La experiencia Usuario de CredixNexus se organiza alrededor de **un hilo continuo**: *pregunto → me ayudan → registro → sigo → me resuelven → califico*. Ese hilo **nunca se rompe ni se ramifica** (P1: hub único). Todo lo demás —catálogo, conocimiento, IA— son **afluentes** de ese hilo, no destinos separados.

Tres verbos gobiernan cada pixel:

1. **Entiéndeme** (User First + Zero Training): lenguaje humano, cero jerga ITSM (nada de "incident/CI/CMDB" frente al usuario). El sistema habla de *"tu caso"*, *"tu solicitud"*, *"tu equipo de soporte"*.
2. **Muéstrame, no me hagas leer** (Consumer Grade + Progressive Disclosure): el estado se comunica **gráficamente** en < 3 s; el texto es el segundo nivel, no el primero.
3. **Explícame** (Explainability + AI Native): toda cifra, prioridad, SLA o sugerencia responde *por qué / con qué evidencia / qué impacto* con un gesto (hover/tap).

**Antítesis explícita (qué NO seremos):** grillas homogéneas de tarjetas rectangulares, tablas de métricas de operación frente al usuario, cuatro contadores planos, formularios administrativos. El diagnóstico del encargo (confirmado HECHO en §7 del inventario: UX-001, UX-012) es la lista de lo que eliminamos.

---

## 2. Lenguaje visual

### 2.1 Personalidad
Referentes de registro (no de copia): **Linear** (densidad con calma, jerarquía tipográfica), **Stripe** (claridad de dato financiero, confianza), **Arc/Raycast** (comando y velocidad), **Notion** (bloques legibles), **Apple** (motion con propósito). Resultado buscado: *sereno, preciso, premium, humano* — un producto que **inspira confianza fintech** sin sentirse bancario-burocrático.

### 2.2 Marca y temas (HECHO + decisión pendiente)
- **HECHO:** el repo tiene **dos temas** conmutables por `data-theme` (`nexus` oscuro / `claro` claro). Ambos usan **acento rojo Credix** (`#E4002B` Nexus / `#E30613` Claro, alineado a credix.com por commits recientes). El secundario es **teal** (`--teal`).
- **DISCREPANCIA a resolver (INTERPRETACIÓN):** CLAUDE.md §11 describe *"Nexus lima / Claro rojo"*, pero el código real (fuente de verdad) NO tiene lima como acento — Nexus es rojo sobre negro. Propongo **tomar el código como verdad** (rojo de marca credix.com) y reservar **teal/lima como color de dato secundario** (data-viz), no como acento de marca. → Requiere confirmación (§10, decisión estética).

### 2.3 Tipografía (extiende lo existente)
- `--font-display` (Jakarta) — títulos y números-héroe. `--font-ui` (Inter) — cuerpo. `--font-mono` (JetBrains) — **todo dato numérico** (nº de caso, montos, fechas, contadores) con `tnum`. *(HECHO: ya es la convención; la mantenemos y la hacemos regla.)*
- **Escala tipográfica propuesta (hoy los tamaños son px sueltos inline — deuda):** una rampa de 7 pasos (§9) para acabar con los `fontSize: 12.5/13/15/…` dispersos. **(C)** menos decisiones, ritmo vertical consistente.

### 2.4 Espaciado y layout
- **HECHO/deuda:** el layout usa `px` inline por componente (gap: 16/18/20…). Propongo una **escala de 8pt** (`--sp-1..--sp-9`, §9) y **contenedores de ancho legible** (`--w-prose 720`, `--w-app 1120`). **(C)** ritmo predecible; **(E)** sensación de calidad.
- **Grid del hub:** de "grilla homogénea de tarjetas" a **jerarquía focal** — una zona primaria ancha (el hilo) + una columna de asistencia. Rompe el "cuadrado" (diagnóstico).

### 2.5 Elevación, radios, superficies
- Radios (HECHO, se conservan): `--r-xs 6 … --r-2xl 16 · --r-pill 20`. Uso: tarjetas `--r-xl`, chips `--r-pill`, botones `--r-md`.
- Elevación en **3 niveles** (§9): superficie base, tarjeta (`--sh-card`), flotante (menús/drawers). **(E)** profundidad sobria, no sombras dramáticas salvo foco.

---

## 3. Iconografía
- **HECHO:** set SVG propio estilo Lucide (~45 íconos, `components/ui/icon.tsx`). Es suficiente como base; **se amplía** con los íconos que el concepto necesita (definidos por nombre, no por unicode — §11 CLAUDE.md): `clock` (SLA), `message-circle` (hilo), `bell`, `chevron`, `compass`/`map` (guía), `book-open` (KB), `life-buoy` (ayuda), `sparkle` (IA, ya existe), `smile`/`meh`/`frown` (CSAT).
- **Regla:** todo estado/acción crítica lleva **ícono + etiqueta** (nunca color o ícono solos) → Explainability + accesibilidad (validado, §5.1).

---

## 4. Principios de motion (con propósito, nunca decorativo)
- Tokens de tiempo (§9): `--t-fast 120ms` (hover/press, ya existe), `--t-base 200ms` (entradas/salidas), `--t-slow 320ms` (transiciones de vista/hilo). Easing estándar `cubic-bezier(.2,.7,.2,1)`.
- **Micro-interacciones con significado:** (a) el **anillo SLA** anima su relleno al cargar (comunica "tiempo corriendo"); (b) al crear un caso, la fila **entra** al hilo con un *slide-in* (refuerza "tu caso ya está en seguimiento"); (c) hover en cualquier dato dispara su **tarjeta de explicación**. **(E)** el sistema se siente vivo y responsivo.
- **Accesibilidad (HECHO, se respeta y amplía):** `@media (prefers-reduced-motion: reduce)` desactiva animaciones (ya existe en `globals.css`). Ninguna información depende solo del movimiento.

---

## 5. Lenguaje de datos — los elementos gráficos que sustituyen texto

> Método: guía de visualización (form → color por función → **validar** → marcas → hover → accesibilidad). Cada elemento reemplaza un bloque de texto identificado en el inventario.

### 5.1 Sistema de color semántico de estado / SLA (computado, no estimado)
- **HECHO/decisión dura:** los `--st-*` (critical/high/medium/low/verified/info/eval) son **status colors**, NO una paleta categórica. Validado con el script de la guía:
  - *Nexus (oscuro):* el par **ámbar (`in_progress`) ↔ amarillo (`waiting`)** tiene ΔE 7.9 (deutan) — separación insuficiente por hue.
  - *Claro:* ámbar/amarillo caen **bajo 3:1** de contraste sobre blanco.
- **Regla de diseño (blinda WCAG AA + Explainability):** todo estado se codifica con **triple señal** — *color + ícono + etiqueta*, con **gap de 2px** entre segmentos. El par ámbar/amarillo **nunca** se distingue solo por color: siempre etiqueta directa. Los status colors **jamás** se reutilizan como "serie 4" de un gráfico.
- **Mapa de estado del caso → semántica (INTERPRETACIÓN, espeja el enum `incident.status`):** `new/triaged/assigned` → *info* (en cola) · `in_progress` → *high/ámbar* (en trabajo) · `waiting/reopened` → *medium* (esperando) · `in_evolution` → *eval/violeta* (evolución) · `resolved/closed` → *low/verde* (resuelto) · `cancelled` → *muted*.

### 5.2 Catálogo de elementos gráficos

| Elemento | Sustituye a… (inventario) | Spec de marca | Dónde |
|---|---|---|---|
| **Anillo de progreso SLA** | texto plano de vencimiento (`sla_due_at`) | arco 2px, relleno = tiempo consumido; color = status por umbral; centro = tiempo restante en mono; **etiqueta + tooltip "por qué este SLA"** | Detalle de caso, "mis casos", solicitudes |
| **Donut de casos por estado** | los 4 contadores planos (diagnóstico) | segmentos con gap 2px + **etiqueta directa** por segmento + ícono; centro = total; hover = desglose | Hub (resumen del hilo) |
| **Timeline vertical del caso** | lista/hilo textual de comentarios | stepper vertical: nodos = eventos (creado, asignado, en trabajo, comentario, resuelto), con hora mono, autor, y *quién es "tu equipo"* | Detalle de caso (P2) |
| **Stepper de cumplimiento de solicitud** | estado textual `open/fulfilled` | 3 nodos honestos (Solicitada → En curso → Cumplida); **sin inventar** un paso de "aprobación" que no existe (R3) | Detalle de solicitud |
| **Sparkline / tendencia** | — (nuevo, opcional) | línea 2px, sin ejes, último punto marcado; "tus casos en el tiempo" | Hub (secundario) |
| **Stat tile (KPI)** | contadores numéricos sueltos | número-héroe mono + etiqueta + **micro-explicación**; color solo si hay alerta | Hub, "mis solicitudes" |
| **Medidor de utilidad KB** | métricas de ops (views/deflection/health) — **se ELIMINAN para el usuario** | barra/pill "¿te sirvió?" simple (útil/no) | KB (vista usuario) |

- **Paleta de dato secundaria (no-status):** para tendencias/sparklines que **no** son estado, se usa **teal** (`--teal`) + neutrales — reservando el rojo para marca/alerta y los status colors para estado. (Evita el anti-patrón de reusar color de estado como categórico.)
- **Hover por defecto (guía §5):** todo elemento con plot lleva tooltip; los stat tiles simples no. Filtros en una fila sobre los gráficos.

---

## 6. Dónde vive la IA (nativa, no un botón) — respetando R3

| Superficie | Capability IA | Honestidad (R3) |
|---|---|---|
| **Hub** | *Siguiente mejor acción*: "Tu caso CX-1042 lleva 2 días esperando tu respuesta → responder". Resúmenes de estado en lenguaje natural. | Si no hay dato/modelo → se oculta el bloque, no se inventa. |
| **Intake** | *Consultar* (ya existe, `portalAssist`): guía basada SOLO en KB+casos reales; sugiere categoría; registra `agent_action`. | **HECHO:** ya degrada a búsqueda sin clave IA y muestra "IA no configurada". Se conserva. |
| **Detalle de caso** | Resumen del caso ("¿qué ha pasado?") + explicación del SLA/prioridad. | Contenedor con estado vacío honesto si el resumen no está disponible. |
| **Knowledge** | Búsqueda semántica + "artículos que suelen resolver esto". | Sin respuestas fabricadas; solo material real. |
| **Explainability transversal** | cada cifra/estado/SLA hover → *cómo se calculó*. | Determinístico (no IA) donde el cálculo es una regla; IA solo para redacción. |

> **Regla R3 grabada:** ningún capability IA no implementado se finge. Se diseña **contenedor + estado vacío "disponible próximamente"** y se registra como deuda. El *Command Menu* (Ctrl/⌘K) sigue siendo el acelerador para power-users, pero la IA no depende de él.

---

## 7. Modelo de experiencia por pantalla (las 8 áreas replanteadas)

> Formato: **Qué cambia · Por qué (C/D/E) · Gráfico que sustituye texto · IA · Principios**. Toda cifra proviene de queries vivas (R2); los ejemplos de números son ilustrativos.

### A. Inicio → **Hub del hilo** (`/portal`, dedicada) — P1
- **Qué cambia:** de "hero + chips + intake + sugerencias + lista" apilados, a **tres bandas jerárquicas**: (1) *"Requiere tu atención ahora"* (0–N tarjetas accionables, vacío = estado sereno "todo al día"); (2) *el hilo* — **"Mis casos" unificado** (P1: una sola verdad, ver §D); (3) *pregunta o pide* — intake + catálogo como afluentes.
- **Por qué:** el criterio de éxito #2 (responder en < 3 s "¿qué requiere mi atención?") hoy no se cumple: la página es plana y textual (UX-012). **(C)(D)**
- **Gráfico↔texto:** **donut de casos por estado** sustituye los 4 contadores planos; **anillos SLA** en las tarjetas de atención sustituyen fechas de vencimiento.
- **IA:** *siguiente mejor acción* encabeza la banda 1.
- **Principios:** User First, Progressive Disclosure, Zero Training, AI Native.

### B. Catálogo de Servicios (`/service-catalog` · compartida)
- **Qué cambia:** de grid homogéneo sin búsqueda (UX-006 descubribilidad), a **catálogo guiado**: buscador prominente + categorías con ícono + "lo más solicitado". Cada servicio muestra **SLA como micro-anillo**, no texto.
- **Por qué:** descubribilidad y Zero Training. **(D)(C)**
- **i18n:** las categorías/labels hoy vienen en crudo de BD sin i18n (UX-010) → el concepto exige catalogar sus traducciones (deuda a §1.2).
- **IA:** "¿no encuentras lo que buscas? descríbelo" → puentea al intake.
- **Principios:** Progressive Disclosure, Consumer Grade. **Riesgo (compartida):** STOP antes de tocar — no degradar la vista admin/agente (R1).

### C. Formularios de solicitud (intake portal + `RequestForm` · compartida)
- **Qué cambia:** intake **conversacional y progresivo**: una pregunta a la vez; la urgencia/impacto se **explica** ("esto afecta a… → prioridad estimada Alta, *por qué*"). Hoy fija `impact:"medium"` en silencio (UX-011).
- **Por qué:** Explainability + reducir el "muro de formulario". **(C)(E)**
- **Gráfico↔texto:** **chip de prioridad estimada** con tooltip de derivación, en vez de un select mudo.
- **IA:** consulta previa (deflection) integrada, no como paso aparte.
- **Principios:** Explainability, Progressive Disclosure, User First.

### D. Mis Casos → **hilo unificado** (P1)
- **Qué cambia:** hoy hay **tres** superficies solapadas con scoping distinto (UX-007). El concepto las funde en **un solo componente de "mis casos"**, con la corrección de scoping **por propietario** (P3: UX-002/003) y drill-down real (P2).
- **Por qué:** una sola verdad = menor carga y cero confusión. **(C)(E)** · Seguridad (P3).
- **Gráfico↔texto:** filas con **dot de estado + anillo SLA + mini-timeline** en hover; filtros/segmentos visuales por estado (no tabs textuales).
- **IA:** agrupa/prioriza ("2 casos esperan tu respuesta").
- **Principios:** User First, Enterprise Governance (scoping correcto).

### E. Detalle de caso → **centro de tracking client-centric** (NUEVA, P2)
- **Qué cambia:** hoy el usuario **no puede abrir su caso** (UX-008) — contradice CLAUDE.md §0. Se crea una **vista propia del usuario** (no la de agente): **timeline vertical** del caso + **hilo de comunicación con su equipo** + **anillo SLA** + estado explicado + **CSAT al resolver** (P4).
- **Por qué:** es el corazón del principio "tracking y comunicación permanente". **(E)(C)** · el hilo sobrevive incidencia→evolución (§0): si el caso pasa a `in_evolution`, la vista lo muestra como *"tu caso evolucionó a una mejora — seguimos contigo"*, no como cerrado.
- **Gráfico↔texto:** **timeline** sustituye la lista de comentarios; **anillo SLA** sustituye el texto de vencimiento; **stepper de estado** encabeza.
- **IA:** resumen "¿qué ha pasado con mi caso?".
- **Gobernanza:** requiere **permiso nuevo acotado + RLS por `reported_by_user_id`** (P2/P3) → migración + ledger + pruebas (§10/§11). **STOP** de arquitectura en 1.2.
- **Principios:** los 8, especialmente User First, Causa-Raíz, Explainability, Governance.

### F. Base de Conocimiento → **Knowledge Management real** (dirección del arquitecto)
- **Qué cambia:** de **tabla de métricas de operación** (views/deflection/health/escalations — UX-001, impropio para el usuario) a **descubrimiento visual**: (1) buscador semántico primero; (2) **categorías con ícono** y conteo; (3) "destacados / lo más útil"; (4) artículo con **markdown real** (hoy un mini-parser rompe tablas/enlaces — UX-013) + tiempo de lectura + "artículos relacionados" + "¿te sirvió?". Se **eliminan** las métricas de ops de la vista de usuario.
- **Por qué:** el arquitecto lo marcó como pobre/poco visual/sin clasificación; es deflection real. **(D)(C)(E)**
- **Gráfico↔texto:** tarjetas de categoría + medidor simple de utilidad sustituyen la grilla de columnas de ops.
- **IA:** "artículos que suelen resolver esto" + resumen.
- **Principios:** Zero Training, Consumer Grade, AI Native. **Riesgo (compartida `kb-browser`/`article-view`):** STOP — la vista de agente/curador conserva sus métricas; se **bifurca por rol** sin degradar al curador (R1).

### G. Aprobaciones → **honestamente ausente** (R3)
- **Qué cambia:** no se inventa una bandeja de aprobaciones (no existe para el rol — inventario §Área G). Lo que el usuario **sí** ve es el **estado de cumplimiento** de su solicitud como **stepper honesto** (Solicitada → En curso → Cumplida), sin fabricar un paso de "aprobación" inexistente.
- **Principios:** Explainability, Enterprise Governance (no simular gobierno que no ocurre).

### H. Asistente IA → **ambiente, no destino**
- **Qué cambia:** `/ai-center` es inaccesible al rol (HECHO); la IA del usuario **ya vive** en el intake (`portalAssist`) y se **extiende** al hub (siguiente acción), detalle (resumen) y KB (búsqueda). No hay "pantalla de chatbot" separada como requisito.
- **IA/R3:** todo con degradación honesta y auditado en `agent_action` (ya ocurre).
- **Principios:** AI Native, Explainability.

---

## 8. Verificación contra los 8 principios (trazabilidad)

| Principio | Cómo lo cumple el concepto |
|---|---|
| **User First** | Lenguaje humano, hub del hilo, detalle de caso propio (P2), scoping correcto (P3). |
| **Causa-Raíz First** | El hilo sobrevive incidencia→evolución→proyecto; el detalle muestra la evolución, no un cierre. |
| **AI Native** | IA en hub/intake/detalle/KB; nunca un botón aislado (§6). |
| **Explainability** | Triple señal en estados; tooltips "por qué" en SLA/prioridad/sugerencia (§5.1). |
| **Progressive Disclosure** | Intake conversacional, bandas jerárquicas, complejidad bajo demanda. |
| **Zero Training** | Cero jerga ITSM; catálogo/KB guiados; un solo camino primario. |
| **Consumer Grade** | Registro Linear/Stripe/Apple; motion con propósito; data-viz. |
| **Enterprise Governance** | RLS por propietario (P3), ledger en mutaciones (P2/P4), auditoría IA, WCAG AA — intactos. |

---

## 9. Tokens propuestos (formato implementable — *delta* de `globals.css`, se aplica en 1.2 Bloque A)

> Extiende, **no reemplaza**, los tokens existentes (que ya cubren color de ambos temas y radios). Aquí se añaden: **escala tipográfica**, **escala de espaciado 8pt**, **motion**, **anchos**, y tokens de **data-viz** (anillo SLA, sparkline, gap de segmento). Los `--st-*` y `--accent`/`--cta` existentes se conservan.

```css
/* === Escala tipográfica (acaba con los px inline dispersos) === */
:root{
  --fs-1: 11px;   /* micro / eyebrow */
  --fs-2: 12.5px; /* meta / caption */
  --fs-3: 13px;   /* cuerpo */
  --fs-4: 15px;   /* subtítulo */
  --fs-5: 18px;   /* título de sección */
  --fs-6: 22px;   /* título de página */
  --fs-hero: 28px;/* número-héroe */
  --lh-tight: 1.15;
  --lh-body: 1.55;
}

/* === Espaciado 8pt === */
:root{
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px; --sp-7: 32px; --sp-8: 40px; --sp-9: 56px;
  --w-prose: 720px;   /* ancho legible (KB/artículo/detalle) */
  --w-app: 1120px;    /* ancho de trabajo (hub/listas) */
}

/* === Motion === */
:root{
  --t-fast: 120ms cubic-bezier(.2,.7,.2,1);  /* hover/press (ya existía t-fast) */
  --t-base: 200ms cubic-bezier(.2,.7,.2,1);  /* entradas/salidas */
  --t-slow: 320ms cubic-bezier(.2,.7,.2,1);  /* transición de vista/hilo */
}

/* === Data-viz === */
:root{
  --viz-ring-track: var(--track);      /* fondo del anillo SLA */
  --viz-ring-w: 6px;                    /* grosor del arco */
  --viz-seg-gap: 2px;                   /* gap entre segmentos (regla dura) */
  --viz-line-w: 2px;                    /* sparkline / tendencia */
  --viz-secondary: var(--teal);        /* dato NO-estado (evita reusar status) */
  --viz-secondary-soft: var(--teal-soft);
}
/* Los colores de estado del anillo/donut = --st-*-fg (Nexus) / --st-* (Claro),
   SIEMPRE con ícono + etiqueta + gap (nunca color solo). */

/* === Elevación (3 niveles; --sh-card ya existe por tema) === */
:root{
  --sh-float: 0 12px 32px rgba(0,0,0,.18);  /* menús/drawers/tooltips */
}
```

*(Nota: valores de color de marca y `--st-*` no se redefinen aquí; ya existen y se validaron. El único cambio de color propuesto es de **uso** — teal como dato secundario — no de valor.)*

---

## 10. Decisión estética abierta (máx. 2 alternativas — requiere tu elección)

Existe **una** decisión genuinamente abierta: **el tema por defecto y registro emocional del portal del Usuario**. Ambos temas ya existen en código; la pregunta es cuál es la *cara* del Usuario. Trade-offs:

- **Dirección 1 — "Claro / credix.com" (rojo sobre blanco):** cercano, luminoso, alineado a la marca pública credix.com. Más "producto de consumo", menor fatiga en uso diurno, máxima familiaridad. Riesgo: menos "premium/foco".
- **Dirección 2 — "Nexus / foco" (rojo sobre negro):** premium, concentrado, moderno (Linear/Arc). Realza data-viz y el anillo SLA. Riesgo: menos "amable" para un usuario no técnico; más "herramienta".

*(El usuario podrá conmutar de todos modos; esto define solo el **default** y a qué tema optimizamos primero en 1.2.)*

### 10.1 DECISIÓN DEL ARQUITECTO (2026-07-13)
- **Dirección estética por defecto:** **Claro / credix.com (rojo sobre blanco).** Optimizamos este tema primero en 1.2; Nexus se mantiene conmutable.
- **Discrepancia de marca resuelta:** **el código es la verdad** → rojo Credix es el acento de marca en ambos temas; **teal/lima** pasa a **color de dato secundario** (data-viz), no acento. **CLAUDE.md §11 actualizado** para reflejar la realidad (edición aplicada).

---

## 11. Entregable y estado

- **Archivo:** `docs/fase1/01_sistema_visual_y_concepto.md` (este documento) + bloque de tokens implementable (§9).
- **Cubre:** lenguaje visual (tipografía/espaciado/radios/elevación/motion), sistema de color semántico **validado** (§5.1), iconografía, catálogo de elementos gráficos con specs, IA nativa por superficie (R3), y el replanteo de las 8 áreas anclado a C/D/E y a los 8 principios — incorporando P1–P4 y la dirección de drill-down + KM real.
- **Sin código de producción.** Los tokens se aplican en 1.2 Bloque A.
- **Pendiente de tu decisión:** la dirección estética por defecto (§10) y confirmación de la discrepancia "Nexus lima" vs rojo (§2.2).

---

**STOP — ESPERANDO APROBACIÓN.**

No iniciaré la Sub-Fase 1.2 (implementación) hasta: (a) tu aprobación explícita del concepto, y (b) tu elección de dirección estética (§10). La Sub-Fase 1.2 arranca por el **Bloque A: tokens/design system base + Inicio (Hub)**.
