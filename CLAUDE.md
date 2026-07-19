# CLAUDE.md — Credix Nexus

Guía operativa y reglas permanentes para Claude Code en este repositorio.
Fuente de verdad del proyecto. Leer completo antes de cualquier tarea.

---

## 0. Qué es Credix Nexus

Plataforma **ITSM + Motor de Transformación** audit-grade para Credix (fintech de
crédito B2B). Principio rector:

> Ningún incidente crítico debe quedar como simple ticket si revela una oportunidad
> estructural de mejora, automatización, rediseño, control, riesgo o evolución del negocio.

Capacidades núcleo: mesa de ayuda enterprise (incident/problem/change), motor de reglas +
scoring de transformación, gestión de proyectos, GRC, **ledger inmutable con hash-chaining**,
y capa de IA agentic controlada. Multi-tenant, multiempresa, multimodal, multilenguaje (ES/EN).

### CENTRO DE LA HERRAMIENTA (principio no negociable)

**Tracking y comunicación permanente, client-centric SIEMPRE.** Cuando una incidencia genera un
cambio importante y pasa al **squad de Evolución**, deja de gestionarse como incidencia pero la
**mesa de ayuda nunca pierde el control**: mantiene el tracking y la comunicación con el cliente
de extremo a extremo. El hilo de comunicación **sobrevive** la transición incidencia→evolución→
proyecto. La incidencia queda como **ancla** de comunicación (estado `in_evolution`, no `closed`),
enlazada bidireccionalmente al proyecto de Evolución. Marcos de referencia: **ITIL 4** (incident/
problem/change/knowledge/SLA), **COBIT 2019** (gobierno/control/auditoría), **ISO/IEC 20000** (ITSM).
Toda decisión de diseño se evalúa contra: ¿mejora el tracking y la comunicación con el cliente?

### 0.1 Realidad del stack (adaptación consciente de la spec)

La especificación describe una arquitectura de ~20 microservicios sobre Kubernetes/Kafka/
Temporal. **Este repositorio la materializa como un monolito modular** sobre:

- **Next.js 16 (App Router) + React 19 + TypeScript** — frontend + API (route handlers / server actions).
- **Supabase** — PostgreSQL 17, Auth, **Row-Level Security**, Storage, Edge Functions, Realtime.
- **Tailwind CSS v4** + design system propio (ver §7).

Los "bounded contexts" de la spec se implementan como **módulos** dentro de la app y **esquemas/
funciones** en Postgres. El ledger, el rule engine y el scoring viven como tablas + funciones
PL/pgSQL + lógica de aplicación. Kafka/Temporal/OPA quedan como evolución futura, NO como
requisito de la v1. No inventar infra que no existe en el repo (§2.6).

### 0.2 Proyecto Supabase

- Nombre: `CREDIXNEXUS` · ref: `dffbysjrvvlwgzgakhaa` · Postgres 17 · región ca-central-1.
- Acceso vía **Supabase MCP** (fuente de verdad del esquema) y migraciones en `sql/` (§3.1 #8).

---

## 1. Documentos de referencia

- Especificación funcional/técnica integral: `docs/SPEC.md`.
- Design system (Claude Design): `docs/DESIGN.md` + tokens en `app/globals.css` (§7).
- Placeholder de Claude Design: `docs/CLAUDE_DESIGN_SPECIFICATIONS.md`.
- Catálogo de datos maestros: `docs/architecture/MASTER_DATA_CATALOG.md` (se crea al implementar).
- Roadmap por fases: `docs/ROADMAP.md`.

---

## 2. Disciplina anti-hallucination (hard rules)

### 2.1 NO inventar contexto
PROHIBIDO inventar funciones, tablas, columnas o endpoints; asumir comportamiento implícito;
inferir estructuras no visibles en código, esquema real o docs. Ante duda, responder:
```
Supuestos detectados:
1.
2.
Necesito confirmacion antes de continuar.
```

### 2.2 Root cause first
Antes de proponer solución: causa raíz, impacto, por qué ocurre, evidencia en código.
Prohibido fixes superficiales/workarounds cuando el bug está en el motor.

### 2.3 Deep thinking mode
Para problemas complejos: descomponer, listar hipótesis, validarlas, identificar incertidumbre,
ANTES de escribir código.

### 2.4 STOP conditions
Detenerse y pedir validación del arquitecto si: hay más de 2 supuestos no confirmados; el cambio
afecta múltiples capas (UI + DB + rule engine / ledger); impacta RLS o seguridad; afecta reglas
de negocio sensibles (scoring, decisiones de crédito, GRC).

### 2.5 Modos de operación
Declarar siempre el modo:
- **Arquitecto:** analiza, plantea, NO escribe código de producción.
- **Implementador:** ejecuta sobre plan aprobado, sin desviarse.

### 2.6 Verify-over-infer
Filesystem, git y el **esquema real de Supabase (MCP)** son las únicas fuentes de verdad sobre
el estado actual. La memoria conversacional y las asunciones NO lo son. Antes de afirmar el estado
de un archivo, tabla, ruta o convención: verificar con `ls`, `git ls-files`, `git grep`,
`Get-Content`, o el MCP de Supabase, en el mismo turno, como evidencia.

---

## 3. Reglas críticas bloqueantes

Violaciones son bloqueantes y requieren autorización explícita del arquitecto.

### 3.1 Lista NUNCA
| # | Regla |
|---|---|
| 1 | NUNCA `git reset --hard` a `origin/main` sin autorización explícita y escrita |
| 2 | NUNCA borrar funcionalidad existente: ledger inmutable, rule/scoring engine, incidentes, proyectos, portal partner |
| 3 | NUNCA modificar `.env.local` ni ningún archivo `.env*` |
| 4 | NUNCA correr `npm run dev` desde Claude Code — lo corre el usuario en su terminal |
| 5 | NUNCA `git push --force` a main |
| 6 | NUNCA commitear secretos, API keys, service_role keys ni credenciales |
| 7 | NUNCA exponer datos cross-tenant — todo query debe ir filtrado por `tenant_id` |
| 8 | NUNCA inventar nombres de tablas/columnas/endpoints sin verificar contra el esquema real (Supabase MCP / `information_schema`, o migraciones `sql/`) |
| 9 | NUNCA `git commit --amend` sin autorización explícita del arquitecto |
| 10 | NUNCA bypass de hooks (`--no-verify`, `SKIP_*`) sin documentarlo en `tasks/lessons.md` |
| 11 | NUNCA `git add .` ni `git add -A` sin inspección previa del diff completo |
| 12 | NUNCA exponer PII (nombre, cédula, datos financieros de partner) en logs — enmascarar |

### 3.2 Lista SIEMPRE
| # | Regla |
|---|---|
| 1 | SIEMPRE verificar que el archivo existe antes de editarlo y mostrar el diff propuesto |
| 2 | SIEMPRE correr `npm run build` antes de commit y reparar errores antes de continuar |
| 3 | SIEMPRE mantener RLS encendido: toda tabla nueva con `tenant_id` necesita `ENABLE ROW LEVEL SECURITY` + policy por `tenant_id` |
| 4 | SIEMPRE usar paths explícitos en `git add <paths>` o `git add -p` |
| 5 | SIEMPRE verificar autorización antes de `git reset`, `git amend` o cualquier operación destructiva |
| 6 | SIEMPRE incluir `tenant_id` en queries a tablas con datos de tenant |
| 7 | SIEMPRE usar ASCII español sin tildes en mensajes de commit (encoding seguro Windows + Git for Windows) |
| 8 | SIEMPRE mantener y correr **pruebas Playwright E2E exhaustivas** como parte del ciclo de cada cambio (no paso final opcional), con foco en el **rol usuario** (`partner_user` / Mi Portal). Correrlas contra el server que levanta el usuario (`playwright.config` con `reuseExistingServer`), ya que §3.1 #4 impide `npm run dev` desde Claude Code. Si el server no esta arriba, pedir al usuario `! npm run dev` y correr `npx playwright test`; nunca declarar un cambio de UI "listo" sin cobertura E2E del flujo afectado. |

---

## 10. Regla permanente: Integridad de datos maestros, tablas y validaciones

**Política obligatoria (no recomendación).** Cada vez que se cree/modifique/consuma una tabla,
campo, dato maestro, catálogo, parámetro o entidad funcional, asegurar **integridad completa**
desde BD, lógica de negocio, UI, validaciones, mensajes, permisos y pruebas. PROHIBIDO
implementar con datos hardcodeados, estructuras incompletas, validaciones parciales o supuestos
no verificados contra la BD real.

### 10.1 Descubrimiento previo obligatorio
Antes de escribir código, verificar empíricamente (§2.6) si ya existe: tabla/vista/RPC/endpoint/
servicio/tipo/schema/validador/pantalla/ruta/permiso/prueba/seed/catálogo/relación/constraint.
Si existe, reutilizar y extender; si no, crear completo según esta regla.

### 10.2 Estructura de BD (mínimos de integridad)
Migración formal con: nombre consistente; PK; obligatorios/opcionales; tipos correctos
(texto, número, fecha, booleano, UUID, enum, JSONB, moneda, porcentaje); auditoría
(`created_at/updated_at/created_by/updated_by`); estado (`status`/`is_active`); **soft delete**
cuando el dato pueda estar referenciado por transacciones; índices; `NOT NULL`; `CHECK`;
`UNIQUE`; FK; reglas `ON DELETE`/`ON UPDATE`. Prohibido crear tabla sin restricciones mínimas.

### 10.3 Validación por campo (según naturaleza)
- **Texto:** requerido/opcional; min/max; trim; formato (email, código, teléfono, moneda, país);
  normalización mayúsc/minúsc; evitar duplicados por espacios/acentos/mayúsculas.
- **Números:** tipo real; min/max; entero/decimal; escala/precisión; sin negativos salvo negocio;
  porcentajes 0–100 o 0–1; montos con moneda, precisión y redondeo.
- **Fechas:** válida; **`inicio` no mayor que `fin` y `fin` no menor que `inicio` (ambos sentidos)**;
  sin solapamiento de vigencias cuando deba haber una sola activa; UTC en almacenamiento, zona del
  tenant/usuario en visualización; aprobación no anterior a solicitud; cierre no anterior a apertura.
- **Booleanos:** valor explícito; default definido.
- **Catálogos/relaciones:** todo valor asociado a otra tabla viene de un maestro formal; PROHIBIDAS
  listas hardcodeadas en frontend si son datos maestros; selects consultan la fuente real; mostrar
  **nombre descriptivo, no solo el ID**; validar existencia antes de guardar; respetar FK.

### 10.4 Control de duplicados (unicidad funcional)
Validar en **tres capas**: BD (unique/constraint), servicio/API (antes de insertar/actualizar) y
formulario (antes/durante guardado), con mensaje claro mostrando el registro existente.

### 10.5 CRUD completo + pantalla de Datos Maestros
Todo maestro administrable: incorporar, modificar, eliminar/desactivar/archivar, consultar, buscar,
filtrar, ordenar, ver detalle, confirmar operaciones críticas, errores comprensibles. Si está
referenciado, **no borrar físicamente** (soft delete). Vista en módulo de Datos Maestros con
listado, alta, edición, detalle, activar/desactivar, filtros, búsqueda, estados visibles, mensajes
de carga/vacío/error/confirmación, validación visual por campo. NO está terminado si solo existe la
tabla o solo el formulario.

### 10.6 Mensajes al usuario (un caso por operación)
- **Error:** qué campo, por qué, qué corregir; distinguir duplicidad, permisos, relación inexistente,
  vigencia inválida, restricción de BD. Prohibido "Error al guardar" genérico si cabe precisión.
- **Éxito por CADA operación:** creado, actualizado, eliminado/desactivado, cancelado, reactivado.
- **Confirmación crítica explícita** antes de eliminar/desactivar/modificar datos sensibles.

### 10.7 Validación en capas
BD (constraints/FK/unique/checks) + backend/API (negocio) + frontend (UX inmediata) + pruebas.
Prohibido depender solo del frontend.

### 10.8 Seguridad y permisos
Por tabla/maestro: quién consulta/crea/edita/elimina; RLS/policies por rol y por `tenant_id`;
usuarios sin permiso no acceden por UI ni API; no exponer datos sensibles innecesariamente.

### 10.9 Consistencia visual y funcional
Seguir el design system (§7 y `docs/DESIGN.md`): layout, navegación, formularios, componentes
reutilizables, forma de mostrar errores/confirmaciones, convención de nombres, arquitectura de
carpetas, accesibilidad. NO crear componentes aislados si ya existe patrón reutilizable.

### 10.10 Pruebas obligatorias
Cubrir: creación/edición válidas; consulta/listado; eliminación/desactivación; requeridos; tipos;
fechas (ambos sentidos); duplicados; FK; permisos; multi-tenant; estados vacíos; errores backend;
bordes. No terminado sin pruebas que cubran la integridad.

### 10.11 Definition of Done
Terminado solo cuando: estructura BD + migración + tipos + restricciones + relaciones + validaciones
(BD/backend/frontend) + control de duplicados + CRUD + pantalla de Datos Maestros cuando aplique +
mensajes + permisos/RLS + pruebas + sin hardcode donde debe haber catálogo + UI con valores
descriptivos + i18n ES/EN + eventos de auditoría (ledger) + respeto de patrones + supuestos
documentados.

### 10.12 Regla de bloqueo (anti-"listo" prematuro)
Si falta cualquiera de §10.11, **detenerse y reportar qué falta** antes de declarar terminado.
Prohibido responder "listo/completo" sin poder demostrar estructura, validaciones, CRUD, UI,
seguridad, mensajes, auditoría y pruebas. Si algo no se pudo implementar, decirlo explícitamente.

### 10.13 Cierre obligatorio (resumen de entrega)
En tareas de datos maestros/tablas/catálogos: resumen con archivos modificados; migraciones;
tablas/campos impactados; validaciones; pantallas; mensajes; reglas de duplicidad; permisos/RLS;
pruebas; riesgos/pendientes/supuestos.

---

## 11. Reglas específicas Credix Nexus

- **CERO hardcode / CERO mock (regla dura del usuario, no negociable):** prohibido hardcodear o
  mockear datos, listas, catálogos, mapeos, umbrales de negocio, relaciones o respuestas en el
  código. Todo valor de negocio sale de la **BD real** (catálogos/tablas/relaciones) y toda lógica
  configurable (pesos, umbrales, mapeos categoría→habilidad, etc.) vive en datos, no en constantes
  del código. Excepción única: constantes que **espejan** un enum/estructura del esquema (p.ej. lista
  de estados abiertos) y flags de UI puros. Ningún componente puede stubbear/mockear resultados.
- **Audit-grade absoluto:** ninguna mutación relevante de negocio existe sin su
  `immutable_audit_event`. Si el evento de ledger no se puede registrar, la operación falla y
  se revierte (transacción). Ver `docs/SPEC.md` §10.
- **Multi-tenant desde el origen:** todo dato operativo lleva `tenant_id` + RLS (§3.2 #3).
- **i18n real:** cero textos quemados; todo copy visible sale de catálogos/archivos de traducción
  ES/EN.
- **Rule/Scoring engine versionado:** una regla no se publica sin simulación y aprobación; toda
  versión queda inmutable y auditada.
- **IA con gobierno:** un agente nunca aprueba cambios, borra datos, modifica reglas publicadas ni
  cruza tenants; toda acción de agente se registra (prompt, modelo, input/output, confianza).
- **Design system:** dos temas conmutables **Nexus** (oscuro) y **Claro** (claro), **ambos con acento
  rojo Credix** (credix.com: `#E4002B` Nexus / `#E30613` Claro; fuente de verdad = `app/globals.css`).
  El **teal/lima** (`--teal`) es color de **dato secundario** (data-viz), NO acento de marca. El portal
  del rol Usuario tiene a **Claro como tema por defecto**. Datos numéricos en JetBrains Mono. Detalle en
  `docs/DESIGN.md`.
- **Tenant != Product != Party-role (invariante de modelo):** el `tenant` es una figura amplia =
  **modo operativo/de entrega** (`operating_mode` ∈ saas|bpo|enterprise|internal|marketplace). NO es
  un producto (catálogo) ni un rol de party. Quién participa (originator, investor, buyer, merchant)
  va en `party_role`. Los sistemas legacy (SAC, Prisma, MiCredix, Flip, Autocartera) son **sistemas**
  → `service`/`configuration_item` (CMDB), NUNCA tenants.

---

## 12. Convenciones de repo

- Migraciones SQL versionadas en `sql/` (idempotentes donde se pueda). El esquema real de Supabase
  manda; no se genera `database.ts` automáticamente.
- Componentes UI en `components/`, módulos de dominio en `app/(app)/<modulo>/`.
- Tipos compartidos en `lib/types/`. Clientes Supabase en `lib/supabase/`.
- Commits: ASCII español sin tildes (§3.2 #7). Terminar mensajes con:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
