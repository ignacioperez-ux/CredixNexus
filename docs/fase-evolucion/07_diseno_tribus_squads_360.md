# CredixNexus — Diseño de estructura de equipos (dominio-first) y visión 360° de Evolución

> **Modo:** Arquitecto (propuesta de diseño; no toca producción). **Fecha:** 2026-07-15.
> **Base:** esquema real de CredixNexus (catálogo `06_catalogo_evolucion_squads.md`) + modelo objetivo
> de squads/tribus para Credix. Objetivo: definir el modelo, cómo reflejarlo en la herramienta,
> las ayudas contextuales, las vistas/BI y el **gap** contra lo actual.

---

## 0. Principio rector (no negociable del diseño)

> **Un squad no es un comité para ejecutar un proyecto. Es un equipo estable, multidisciplinario y
> dueño de una capacidad permanente del negocio.** Los proyectos y mejoras **viajan por** los squads;
> no definen la organización.

Consecuencia directa para el modelo de datos actual: hoy `project.squad_id` es **1:1** (un proyecto
= un squad). Eso codifica el modelo equivocado ("squad por proyecto"). El diseño correcto es
**N:N**: una iniciativa atraviesa varios squads, cada squad tiene su backlog permanente (run + change).

---

## 1. Objetos del modelo y cómo se relacionan

```
Comité de Transformación
   └── Tribu (flujo de valor)            [NUEVO objeto: tribe]
         └── Squad (dominio/capacidad)   [squad + tribe_id, mission, tipo, run/change]
               ├── Roster de talento      [squad_member ✔]  ── Chapter (especialidad)  [NUEVO]
               ├── Backlog único          [backlog_item / project_task ✔ parcial]
               ├── KPIs del squad         [squad_kpi  NUEVO]
               ├── Dominio/capacidad       [business_capability  NUEVO]
               └── Sistemas/productos      [ownership: squad ↔ service/product/CI  NUEVO]
Iniciativa (proyecto | mejora | demanda | run)  [project + tipo]
   ├── viaja por N squads                 [project_squad N:N  NUEVO]  (uno es "lead")
   ├── nace de un caso/recomendación       [created_from_incident_id ✔ / recommendation ✔]
   ├── tareas asignadas a talento          [project_task.assigned_member_id ✔]
   └── dependencias entre squads           [dependency  NUEVO]  (Scrum of Scrums)
Chapter (UX, QA, Data, Backend, Sec, Arquitectura, Agilidad)  [NUEVO]
   └── chapter_member: talento ↔ chapter (matricial)          [NUEVO]
Guild (IA, APIs, Gobierno de datos…)  [NUEVO opcional, comunidad informal]
```

### 1.1 Definición de cada objeto y su información clave

| Objeto | Qué es | Campos clave (además de auditoría/tenant) |
|---|---|---|
| **Tribu** (`tribe`) | Agrupación de squads por **flujo de valor**. | `code`, `name`, `mission`, `value_stream`, `tribe_lead_user_id`, `objective` (OKR), `status`. |
| **Squad** (`squad` +) | Equipo estable dueño de una **capacidad**. | + `tribe_id`, `mission`, `squad_type` (domain/enabler/transient), `business_capability_id`, `business_owner_user_id`, `po_user_id` ✔, `tech_lead_user_id`, `agile_lead_user_id`, `handles_run` (bool), `handles_change` (bool). |
| **Capacidad de negocio** (`business_capability`) | El dominio que gobierna el squad (originar, cobrar, conciliar…). | `code`, `name`, `description`, `owner_tribe_id`. |
| **Chapter** (`chapter`) | Comunidad de una **especialidad** distribuida en squads. | `code`, `name` (UX/QA/Data/Backend/Sec/Arq/Agilidad), `lead_user_id`, `standards_url`. |
| **Chapter member** (`chapter_member`) | Talento ↔ chapter (matriz). | `chapter_id`, `member_id`, `role` (lead/member). |
| **Guild** (`guild`) | Comunidad informal por tema (IA, APIs…). | `code`, `name`, `topic`. Sin backlog formal. |
| **Iniciativa** (`project` +) | Trabajo **temporal** (proyecto/mejora/demanda). | + `initiative_type` (project/improvement/demand/run_item), `lead_squad_id`. Ya tiene WSJF, ROI, roadmap, origen. |
| **Iniciativa ↔ squads** (`project_squad`) | **N:N**: qué squads participan y con qué rol. | `project_id`, `squad_id`, `role` (lead/contributing), `allocation_pct`, `status`. |
| **Dependencia** (`dependency`) | Bloqueo/necesidad entre squads o iniciativas. | `from_squad_id`, `to_squad_id`, `initiative_id`, `type`, `status`, `blocking` (bool), `note`. |
| **KPI de squad** (`squad_kpi`) | Métrica de valor del squad con meta. | `squad_id`, `metric_code`, `name`, `unit`, `target`, `current`, `period`, `direction`. |
| **Ownership sistemas** (`squad_asset`) | Qué sistemas/productos/CIs gobierna el squad. | `squad_id`, `entity_type` (service/product/configuration_item), `entity_id`. |

**Talento (`team_member`) ✔** ya existe con `discipline`, `seniority`, `capacity_points`, `delivery_area_id`.
La **asignación estable** se modela en `squad_member` ✔ (roster con `allocation_pct`, `squad_role`,
`valid_from/to`). La **asignación a iniciativas** se modela en `project_task.assigned_member_id` ✔ y
se agrega vía `project_squad`.

---

## 2. Mapa objetivo para Credix (tribus → squads)

Modelo objetivo (no crear todo de golpe). Cada squad es dueño de un **dominio**, con backlog, PO,
métricas y sistemas.

| Tribu (flujo de valor) | Squads (dominio) | Sistemas/áreas que gobierna |
|---|---|---|
| **Canales, Cliente y Experiencia** | MiCredix & Self-Service · Atención Omnicanal / Contact Center · Comunicaciones & Consentimiento | MiCredix, portal, WhatsApp, IVR, notificaciones |
| **Crédito, Originación y Riesgo** | Originación & Onboarding · Scoring, Límites & Decisioning · Catálogo de Productos | Originación, buró, motor de reglas, productos |
| **Core, Tarjetas y Pagos** | SAC Encapsulation / Core Shield · Prisma / Autorizaciones · Cuenta Corriente / Ledger · Pagos & Recaudación | SAC, Prisma, ledger, SINPE/BN |
| **Comercios y Adquirencia** | Onboarding Comercios · SmartPOS / VPOS / Pasarela · Liquidación & Conciliación Comercios | CredixLink, POS, VPOS |
| **Cobranza y Recuperación** | Cobranza Omnicanal · Promesas de Pago / Flip · Analítica de Mora | Flip, campañas, mora |
| **Datos, BI e IA** | Data Platform · BI Products · Data Governance · IA / Modelos | Lakehouse, dashboards, glosario |
| **Plataforma, Integración y Seguridad** | APIs e Integración · DevOps/SRE · Seguridad & Cumplimiento · QA Automation | Gravitee, AWS, IAM (enablers) |
| **Finanzas, Tesorería y Backoffice** | Finanzas Digital/ERP · Tesorería & Conciliación · Automatización/RPA | Exactus, conciliaciones |

**Mínimo inicial (8 squads):** SAC Encapsulation · Prisma/Tarjetas · Cuenta Corriente/Ledger ·
Originación & Onboarding · MiCredix & Canales · Cobranza Omnicanal · Comercios & Adquirencia ·
Data Platform & Governance. **Enablers/Chapters transversales:** DevOps/SRE, APIs, QA, Seguridad,
UX, Data, Arquitectura, Agilidad.

En el modelo de datos esto se distingue con `squad.squad_type`:
- `domain` → squad de negocio (dueño de capacidad).
- `enabler` → plataforma/habilitador (reemplaza el actual `is_transversal`, que se conserva como
  compatibilidad → un enabler es transversal).
- `transient` → squad temporal de una iniciativa (excepción, no la norma).

---

## 3. Composición de un squad (estable) y rol de Comercial

| Rol | Dedicación típica | En el dato |
|---|---|---|
| Product Owner | 100% | `squad.po_user_id` |
| Business Owner (dueño ejecutivo del resultado) | — | `squad.business_owner_user_id` **(nuevo)** |
| Tech Lead | 50–100% | `squad.tech_lead_user_id` **(nuevo)** |
| Agile Lead / Scrum Master | parcial/compartido | `squad.agile_lead_user_id` **(nuevo)** |
| Business SME | 30–70% | `squad_member` con `squad_role='sme'` |
| UX / Service Designer | 30–100% | `squad_member` + `chapter=UX` |
| Backend / Frontend / Mobile | 100/50–100% | `squad_member` + `chapter` respectivo |
| QA Automation | 50–100% | `squad_member` + `chapter=QA` |
| Data Analyst/Engineer | 30–100% | `squad_member` + `chapter=Data` |
| DevOps/SRE, Security | parcial | `squad_member` (enabler) |

**Comercial** no es "un representante en cada squad". Participa como **Business Owner** (impacta
ingresos), **PO** (si prioriza de verdad) o **SME/stakeholder**. En el dato: `business_owner_user_id`
o `squad_member.squad_role='sme'`. Nunca como asiento decorativo.

---

## 4. Cómo escala un caso a mejora/proyecto (flujo actual + ajuste)

**Hoy (real):** `incident` (caso) → `transformation_candidate`/`transformation_score` → derivación
(`sendToEvolution`) o `project_recommendation` → aprobación del RC (`decideRecommendation`) →
`convertRecommendation` crea `project` con `created_from_incident_id`. La incidencia queda como
**ancla** (`status=in_evolution`). ✔ Esto ya está bien y es la base.

**Ajuste de diseño:** al convertir, el proyecto debe poder **asignarse a el/los squad(s) dueños del
dominio** (no crear un squad para el proyecto). Es decir: `convertRecommendation` debe enrutar la
iniciativa al **squad dueño de la capacidad** (por `business_capability` del sistema/producto
afectado) y permitir agregar squads contribuyentes (`project_squad`). El "squad temporal de
proyecto" se vuelve la excepción (`squad_type='transient'`), no la regla.

**Enrutamiento sugerido (regla, no hardcode):** del caso se conoce `affected_service_id` /
`affected_product_id` / `affected_process_id`. Un mapeo `capability ↔ service/product` (tabla
`squad_asset`) permite proponer automáticamente el **squad dueño** como `lead_squad_id`. El humano
confirma (gobernanza intacta).

---

## 5. Gobierno del trabajo (se refleja en la herramienta)

- **Un backlog por squad** (run + change en la misma lista priorizada). Hoy `project_task` cuelga de
  un `project`; falta un **backlog de squad** que agregue tareas de varias iniciativas + mejoras
  recurrentes + deuda técnica. → objeto `backlog_item` (o vista que una `project_task` de todas las
  iniciativas del squad + items de run).
- **Priorización WSJF** ✔ ya existe en `project` (valor+criticidad+riesgo / tamaño). Extender a
  `backlog_item`.
- **Cadencias** (daily, refinamiento, review, retro, revisión de tribu, comité de arquitectura,
  planificación de portafolio) → no requieren tablas nuevas salvo un `ceremony`/calendario opcional.
- **Scrum of Scrums / dependencias** → objeto `dependency` (cross-squad), visible en un tablero.
- **Niveles de liderazgo:** Comité de Transformación → Tribe Leads (`tribe.tribe_lead_user_id`) →
  POs (`squad.po_user_id`) → Chapters (`chapter.lead_user_id`).

---

## 6. Ayudas contextuales (educar sobre tribu/squad/chapter)

Objetivo: que desde **cualquier** pantalla donde se mencione un concepto, el usuario active una
ayuda con **definición + ejemplo Credix**.

**Diseño (data-driven, cero hardcode):**
- Catálogo `concept` (maestro): `code` (tribe, squad, chapter, guild, po, business_owner, tech_lead,
  agile_lead, domain, run_change, wsjf, initiative, dependency…), `term`, `short_def`, `long_def`,
  `example_credix`, `learn_more_url`. Bilingüe (ES/EN) vía i18n.
- Componente reutilizable **`<ConceptTip concept="squad">`**: envuelve un término y muestra tooltip
  (definición corta) + enlace "saber más" que abre un **drawer de ayuda** con la definición larga y
  el ejemplo Credix.
- **Centro de Ayuda** activable desde el `HelpFab` (ya existe) y desde el Command Menu: busca y
  navega los conceptos.
- Ejemplos Credix incrustados en el catálogo: *"Squad de Originación: dueño de solicitud, onboarding,
  scoring-link, activación"*, *"Squad de Cobranza Omnicanal: recuperación por canales, promesas,
  contactabilidad"*, *"Tribu Core, Tarjetas y Pagos: SAC + Prisma + Ledger"*.
- Regla de UX: los títulos de sección "Tribu", "Squad", "Chapter", "Capacidad" en las pantallas
  llevan siempre el `ConceptTip`. Así la educación es ubicua, no una pantalla aparte.

---

## 7. Vistas e inteligencia de negocio (visión 360° del Gerente de Evolución)

### 7.1 Vista de alto nivel — **Mapa de Tribus** (`/evolucion/mapa`)
Value-stream map: tribus como columnas, squads como tarjetas; por squad: carga (capacidad vs
demanda), # iniciativas activas, salud (KPIs), dependencias abiertas. Drill-down: tribu → squad →
iniciativa. Filtros por tribu, tipo de squad (domain/enabler), salud.

### 7.2 Squad 360 (`/squads/[id]`, extendido)
Misión · dominio/capacidad · tribu · Business Owner/PO/Tech Lead/Agile Lead · **roster** (con chapter
de cada persona) · **capacidad vs demanda** · **KPIs con meta vs actual** · **backlog priorizado**
(run+change) · **iniciativas activas** (con % de avance) · **dependencias** · **sistemas/productos que
gobierna**.

### 7.3 Iniciativa 360 (`/projects/[id]`, extendido)
Demanda → recomendación → proyecto → **squads involucrados** (lead + contribuyentes) → tareas →
QA/deploy → **outcome/KPI**. Fases, **blockers**, **riesgos**, ROI real vs estimado, caso ancla con
hilo al cliente (§0, ya existe). Trazabilidad de punta a punta.

### 7.4 Portafolio / Flow (extiende `/projects/portafolio`)
WSJF, ROI real vs estimado (✔), **heatmap de capacidad** por squad/tribu, **métricas de flujo**
(throughput, lead time, WIP, aging), tablero de riesgos/blockers, ratio **run vs change**.

### 7.5 Talento & Skills (extiende `/talent`, `/workload`)
Cobertura de skills vs necesidades de las iniciativas (**fit**), carga por persona/squad (✔ con
columna de squad + transversal ya agregada), chapters.

### 7.6 Dashboards ejecutivos
- **Funnel incidencia → evolución:** casos → candidatos → recomendaciones aprobadas → proyectos →
  entregados (con conversión por etapa y tiempo). (Base: `converted_cases` ✔ + análisis de
  comportamiento ✔.)
- **Valor entregado:** ROI real acumulado, beneficios liberados, mejoras cerradas.
- **Progreso de desacople SAC:** APIs publicadas, integraciones punto-a-punto eliminadas,
  funciones extraídas (KPIs del Squad SAC Encapsulation).
- **Salud de tribus:** OKR por tribu, capacidad, dependencias críticas.

**Métricas realmente útiles (no vanidad):** lead time demanda→producción, throughput por squad,
% capacidad comprometida, ROI real vs estimado, ratio run/change, mora/recuperación (dominio
cobranza), conversión de originación, incidentes por sistema (calidad), dependencias bloqueantes.

---

## 8. GAP — actual vs propuesto (para planear modificaciones)

| Tema | Hoy (real) | Propuesto | Acción |
|---|---|---|---|
| Agrupación de squads | Squads sueltos (`squad.business_unit_id`) | **Tribus** (flujo de valor) | Nueva tabla `tribe` + `squad.tribe_id`. |
| Naturaleza del squad | `is_transversal` (bool) | `squad_type` (domain/enabler/transient) + `mission` + capacidad | Extender `squad`; mapear `is_transversal→enabler`. |
| Dueño ejecutivo / liderazgo | Solo `po_user_id` | + Business Owner, Tech Lead, Agile Lead | Añadir 3 FKs a `squad`. |
| Capacidad de negocio (dominio) | No existe explícita | `business_capability` + ownership de sistemas | Nuevas tablas `business_capability`, `squad_asset`. |
| Proyecto ↔ squad | **1:1** (`project.squad_id`) | **N:N** (lead + contribuyentes) | Nueva tabla `project_squad`; conservar `squad_id` como lead. |
| Tipo de trabajo | `project_type` | + `initiative_type` (project/improvement/demand/run) | Extender `project`. |
| Backlog | Tareas por proyecto (`project_task`) | **Backlog único por squad** (run+change) | Vista/objeto `backlog_item` agregando tareas + run. |
| Chapters / matriz | No existe | `chapter` + `chapter_member` | Nuevas tablas; poblar desde `discipline`. |
| Guilds | No existe | `guild` (opcional) | Nueva tabla (fase posterior). |
| Dependencias cross-squad | No existe | `dependency` (Scrum of Scrums) | Nueva tabla + tablero. |
| KPIs por squad | No (solo métricas globales) | `squad_kpi` (meta vs actual) | Nueva tabla + tarjetas en Squad 360. |
| Ayudas contextuales | `HelpFab` genérico | Catálogo `concept` + `ConceptTip` ubicuo | Nueva tabla `concept` + componente. |
| Vista de tribus | No existe | Mapa de Tribus (alto nivel) | Nueva pantalla `/evolucion/mapa`. |
| Enrutamiento caso→squad dueño | Manual (elige squad) | Sugerido por capacidad/sistema | Regla sobre `squad_asset` (IA sugiere, humano confirma). |

**Lo que ya está bien y se conserva:** funnel incidencia→evolución (ancla §0), recomendaciones,
WSJF, ROI real, roadmap, capacidad por squad, scorecard proveedores, análisis de comportamiento,
casos convertidos, campanita, talento (CRUD §10), `squad_member` con allocation.

---

## 9. Roadmap de implementación sugerido (fases, aprovechando lo hecho)

1. **F1 — Tribus y squads de dominio:** `tribe`, `squad.tribe_id/squad_type/mission` + roles
   (BO/TechLead/AgileLead) + Mapa de Tribus + `ConceptTip`/catálogo `concept`. (Estructura y
   educación primero.)
2. **F2 — N:N iniciativa↔squad + tipo de iniciativa:** `project_squad`, `initiative_type`,
   enrutamiento sugerido por capacidad. Iniciativa 360 con squads involucrados.
3. **F3 — Backlog por squad + KPIs + dependencias:** `backlog_item`/vista, `squad_kpi`,
   `dependency` + Scrum of Scrums board. Squad 360 completo.
4. **F4 — Chapters/Guilds + fit de skills + dashboards ejecutivos:** `chapter`/`chapter_member`,
   fit skills↔iniciativa, funnel y desacople-SAC ejecutivos.

Cada fase es entregable e incremental; nada rompe lo existente (paridad).

---

## 10. Resumen en una frase para el equipo
> No creamos squads porque hay proyectos. Creamos squads porque hay **capacidades permanentes del
> negocio** (originar, cobrar, atender, transaccionar, conciliar, analizar, desacoplar SAC). Las
> tribus agrupan esas capacidades por flujo de valor, y los proyectos/mejoras **viajan** por los
> squads. CredixNexus debe modelar y **hacer visible** exactamente eso.
