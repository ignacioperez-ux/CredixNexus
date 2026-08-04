# Prompt para Claude Design — Manuales de Credix Nexus

> **Cómo usar este archivo.** Copia el bloque delimitado por `=== INICIO DEL PROMPT ===` /
> `=== FIN DEL PROMPT ===` y pégalo en Claude Design. **Adjunta** junto al prompt el archivo
> `MANUAL_CREDIXNEXUS.md` (el detalle documental completo) y, si los tienes, los **screenshots**
> de cada pantalla nombrados por su ruta (p. ej. `incidents__id.png`). El prompt está escrito para
> que Claude Design produzca los tres manuales respetando el design system de Credix.

---

=== INICIO DEL PROMPT ===

Actúa como **diseñador de documentación de producto y redactor técnico senior** para **Credix
Nexus**, la plataforma ITSM + Motor de Transformación *audit-grade* de Credix (fintech de crédito
B2B). Tu tarea es producir **tres manuales profesionales, listos para publicar**, a partir del
documento fuente que te adjunto (`MANUAL_CREDIXNEXUS.md`) y de los screenshots que acompañan cada
pantalla.

## Fuente de verdad y regla de oro

- El documento adjunto es la **única fuente de verdad**. Fue extraído del código real de la
  aplicación (pantallas, permisos, datos, auditoría). **No inventes** funciones, pantallas, campos,
  botones ni comportamientos que no estén en la fuente. Si algo está marcado *(no verificado)* o
  falta, indícalo como *"pendiente de confirmar"* en un recuadro, no lo completes con supuestos.
- Cuando cites una pantalla, usa **su ruta real** (p. ej. `/incidents/[id]`) y su **nombre de
  negocio** (p. ej. "Detalle de incidencia / Expediente 360").
- Todo texto de la aplicación es **bilingüe ES/EN**. Produce los manuales en **español (principal)**
  y deja preparada la **versión en inglés** de cada uno (misma estructura).

## Los tres manuales a producir

### 1) Manual de Usuario (orientado a tareas, por rol)
Audiencia: usuarios finales y operativos de Credix. Tono claro, directo, sin jerga técnica.
- Estructura por **persona/rol** (Administrador, Gerente de Operaciones, Operador, Gerente de
  Evolución, Miembro de Squad, Usuario final). Para cada rol: qué puede hacer, su pantalla de inicio,
  su navegación, y **guías paso a paso** de sus 3–6 tareas más frecuentes (con capturas anotadas).
- Incluye los **flujos transversales clave**: reportar un caso desde el portal, admitir/triage de un
  caso, asignar y resolver una incidencia, la transición **incidencia → evolución → proyecto**
  (explicando que la incidencia queda como *ancla* y la mesa mantiene el hilo con el cliente),
  declarar un incidente mayor, y consultar el estado de un caso propio.
- Cada tarea: objetivo → precondición/permiso → pasos numerados → resultado esperado → errores
  comunes y cómo resolverlos.

### 2) Manual Técnico (orientado a arquitectura y gobierno)
Audiencia: TI, seguridad, auditoría, implementadores. Tono preciso.
- **Arquitectura y stack**: monolito modular Next.js 16 (App Router) + Supabase (PostgreSQL 17,
  Auth, RLS, Storage). Diagrama de módulos y cómo se relacionan.
- **Modelo de roles y permisos (RBAC)**: tabla rol → permisos → home → navegación; doble capa de
  segregación (permiso de ruta + denylist por persona); RPC `my_access()`.
- **Multi-tenant + RLS**: patrón `tenant_id` + políticas por tenant.
- **Ledger / audit-grade**: `immutable_audit_event`, hash-chaining (SHA-256 + `previous_hash`),
  `append_audit_event`, triggers `audit_row_change()`, verificación `verify_audit_chain`. Explica el
  principio "ninguna mutación de negocio sin su evento de ledger".
- **Motor de reglas y scoring de transformación**: modelo `rule`/`rule_version`, factores y umbrales,
  cómo se decide si un caso pasa a Evolución.
- **IA gobernada**: bitácora `agent_action` (modelo, input/output, confianza, revisión humana),
  límites (un agente no aprueba, no borra, no cruza tenants).
- **i18n, PII, cero-hardcode**: cómo se traduce, cómo se enmascara PII, por qué no hay datos mock.
- Por cada **módulo** incluye una ficha técnica: tablas/entidades principales, permisos, auditoría.

### 3) Manual de Pantallas (referencia visual, una entrada por pantalla)
Audiencia: soporte, capacitación, QA, diseño. Es el **catálogo visual** de las 85 pantallas.
- **Una ficha por pantalla**, agrupadas por módulo, con este formato fijo:
  - **Encabezado**: nombre de negocio + ruta + módulo + roles que la ven.
  - **Captura anotada** (usa el screenshot correspondiente; si falta, deja un marco *placeholder*
    con la nota "captura pendiente").
  - **Para qué sirve** (2–3 frases).
  - **Anatomía de la pantalla**: numera las zonas/secciones y los componentes clave (encabezado,
    filtros, paneles, tablas, pestañas, acciones/botones, estados vacío/carga/error).
  - **Acciones disponibles** y el permiso que cada una requiere.
  - **Datos que muestra** (de dónde vienen, a alto nivel).
- Ordénalas siguiendo el "Índice de pantallas (85)" del documento fuente.

## Sistema de diseño (obligatorio en los tres manuales)

Aplica el **Design System oficial de Credix** en toda la maquetación de los manuales:
- **Acento de marca: rojo Credix `#E42313`** (primary) en **ambos** temas. Úsalo para títulos de
  sección, enlaces, callouts primarios y elementos de énfasis; con moderación, nunca como fondo de
  bloques largos de texto.
- **Dos temas**: **Nexus** (oscuro) y **Claro** (claro). Presenta las capturas/mockups de forma
  coherente con estos temas; si produces el manual como página, ofrécelo **theme-aware** (claro y
  oscuro) y recuerda que el **portal del Usuario final usa Claro por defecto**.
- **Tipografía**: **Heebo** para UI y títulos. **Datos numéricos en tipografía monoespaciada.**
- **Color de dato secundario**: teal/lima solo para gráficos/data-viz, **no** como acento de marca.
- **Componentes de documentación**: usa un sistema visual consistente — portada, tabla de contenidos
  navegable, numeración de secciones, tablas limpias, *callouts* (Nota / Importante / Auditoría /
  Permiso requerido / Pendiente de confirmar), badges de rol, chips de estado (`new`, `triaged`,
  `assigned`, `in_progress`, `resolved`, `in_evolution`, `closed`) e íconos lineales.
- **Accesibilidad**: contraste suficiente en ambos temas, jerarquía tipográfica clara, tablas y
  bloques anchos con scroll horizontal propio (no romper el layout).

## Formato de entrega

1. Entrega **cada manual como un documento independiente** (página/artefacto navegable con portada,
   índice y secciones ancladas). Nombra: *Manual de Usuario*, *Manual Técnico*, *Manual de Pantallas*.
2. Incluye en cada uno: portada con branding Credix, control de versión (v1.0, fecha), un **glosario**
   de términos (incidencia, problema, cambio, incidente mayor, ancla/`in_evolution`, SLA/OLA, WSJF,
   ledger, tenant, persona/rol) y un índice navegable.
3. Marca visualmente todo lo que en la fuente aparezca como *(no verificado)* o pendiente, con un
   callout "Pendiente de confirmar", para que el equipo lo valide antes de publicar.
4. Donde ayude a la comprensión, agrega **diagramas** (flujo de admisión, ciclo de vida de una
   incidencia, transición incidencia→evolución→proyecto, cadena del ledger, mapa de navegación por
   rol). Usa diagramas simples y legibles en ambos temas.

## Antes de empezar

Si detectas ambigüedad o información faltante que impida producir una sección con rigor, **haz
primero una lista breve de preguntas de aclaración**; si no, procede. Comienza por un **esquema
(outline) de los tres manuales** para validación, y luego desarrolla el contenido.

=== FIN DEL PROMPT ===

---

## Anexos operativos (para ti, no para pegar)

- **Adjunta siempre** `MANUAL_CREDIXNEXUS.md`. Si Claude Design tiene límite de tamaño, puedes
  entregarlo por partes usando los encabezados `# Clúster A … E` como cortes naturales.
- **Screenshots**: la cobertura visual del Manual de Pantallas depende de que subas capturas. Sugerido:
  nómbralas por ruta con `/` → `__` (p. ej. `/incidents/[id]` → `incidents__id.png`,
  `/operaciones` → `operaciones.png`). Captura ambos temas (Nexus y Claro) donde sea relevante,
  especialmente el portal del Usuario final.
- **Idioma**: pídele primero la versión ES; la EN sale de la misma estructura (la app ya es bilingüe).
- **Iteración**: si el resultado es muy extenso, pídele primero el *Manual de Pantallas* (el más
  mecánico), luego *Usuario*, y por último *Técnico* (el más denso).
