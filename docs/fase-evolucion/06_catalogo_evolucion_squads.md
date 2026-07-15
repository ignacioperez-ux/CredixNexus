# Catálogo — Rol Evolución y Squads (tablas, campos, pantallas y usos)

> Fuente: esquema real de Supabase (`CREDIXNEXUS`) al 2026-07-15. Generado para análisis.
> Convención: además de los campos listados, casi toda tabla lleva **auditoría** (`created_at`,
> `created_by`, `updated_at`, `updated_by`), `tenant_id` (multi-tenant + RLS) y `id` (uuid PK).

---

## 1. Modelo de datos

### 1.1 Proyectos / Portafolio

**`project`** — el proyecto/mejora de evolución (unidad del portafolio).
| Grupo | Campos | Uso |
|---|---|---|
| Identidad | `project_code`, `name`, `description` | Código y nombre del proyecto. |
| Clasificación | `project_type` (evolution, reconciliation_improvement…), `source_type` (incident/manual), `status` (enum: proposed/approved/on_hold/active/completed/cancelled) | Tipo, origen y estado. |
| Responsables | `sponsor_user_id`, `owner_user_id`, `squad_id`, `business_unit_id`, `product_id`, `delivery_area_id` | Sponsor, dueño, squad asignado, área/producto. |
| WSJF | `business_value`, `time_criticality`, `risk_reduction`, `job_size`, **`wsjf`** (numérico, derivado) | Priorización WSJF desglosada. |
| ROI | `estimated_benefit_amount`, `estimated_cost_amount`, `actual_benefit_amount`, `actual_cost_amount` | ROI estimado vs real (actuals: migración 0094). |
| Roadmap | `planned_start`, `planned_end`, `actual_start`, `actual_end` | Ventana planificada vs ejecución real. |
| Origen (ancla §0) | `created_from_incident_id`, `created_from_recommendation_id`, `created_from_rule_evaluation_id` | Trazabilidad al caso/recomendación/regla que lo originó. |
| Caso de negocio | `business_case` (jsonb) | Narrativa (revisada por humano). |
| QA / deploy | `qa_status`, `prod_authorized_by`, `prod_authorized_at`, `validation_notes` | Compuerta de calidad y autorización a producción. |
| Versionado | `version_no` | Control de versión. |

**`project_task`** — tareas del proyecto. Campos: `project_id`, `title`, `description`, `owner_user_id`, **`assigned_member_id`**, `status`, `priority` (enum), `due_date`, `completed_at`, **`effort_points`** (carga → capacidad de squad), `metadata`.

**`project_validation`** — evidencias de QA. Campos: `project_id`, `name`, `test_type`, `environment`, `result`, `evidence_url`, `notes`, `run_by`, `run_at`.

**`project_recommendation`** — "mejora" propuesta desde un caso (antes de convertirse en proyecto). Campos: `incident_id`, `rule_evaluation_id`, `recommendation_status` (enum: pending/approved/rejected/deferred/converted), `transformation_score`, `recommended_project_type`, `recommended_name`, `recommended_business_case` (jsonb), `business_priority`, `reviewed_by`, `reviewed_at`, `review_reason`, `created_project_id`.

**`project_incident_link`** — vínculo N:N proyecto↔incidencia. Campos: `project_id`, `incident_id`, `link_type`, `linked_at`, `linked_by`.

### 1.2 Squads & Talento

**`squad`** — equipo de entrega. Campos: `code`, `name`, `business_unit_id`, `status` (enum), `po_user_id`, **`is_transversal`** (Equipo transversal vs Squad dedicado), **`capacity_points`** (capacidad), `metadata`, `version_no`.

**`squad_member`** — membresía (roster) N:N miembro↔squad. Campos: `squad_id`, `member_id`, `squad_role`, **`allocation_pct`**, `valid_from`, `valid_to`, `status` (enum), `metadata`.

**`team_member`** — profesional (interno/externo). Campos: `name`, `email` (único por tenant, migración 0097), `user_id`, `status` (enum), **`capacity_points`**, `discipline`, `seniority`, **`is_external`**, `external_type` (subcontractor/intelix), `delivery_area_id` (stream: operaciones/evolución).

**`member_skill`** — competencia del profesional. Campos: `member_id`, `skill_id`, `level` (1-5). Único por (member, skill).

**`member_expertise`** — experiencia en un maestro (process/business_unit/product/channel/configuration_item/service). Campos: `member_id`, `entity_type`, `entity_id`, `level` (1-5). Único por (member, entity).

**`member_evaluation`** — evaluación de desempeño. Campos: `member_id`, `eval_type` (general/incident/project), `performance_score`, `empathy_score`, `comment`, `behavior_note`, `strengths`, `development_areas`, `period`, `entity_type`, `entity_id`, `evaluator_user_id`.

**`delivery_area`** — área de entrega / stream. Campos: `code`, `name`, `description`, `lead_name/email/user_id`, `deputy_name/email/user_id`, `status`.

### 1.3 Proveedores

**`vendor`** — proveedor (para scorecard). Campos: `code`, `name`, `legal_name`, `category`, **`criticality`**, `status` (enum), contacto (`contact_name/email/phone`, `website`), contrato (`contract_number`, `contract_start`, `contract_end`, `sla_terms`), `notes`, `metadata`. Señales derivadas: sistemas provistos (`configuration_item.vendor_id`), incidencias sobre sus CIs, alertas (`monitoring_alert.vendor_id`), disputas (`dispute_case.processor_vendor_id`).

### 1.4 Notificaciones

**`notification`** — bandeja por destinatario (campanita). Campos: `recipient_user_id`, `type`, `title`, `body`, `entity_type`, `entity_id`, `link`, `severity`, `is_read`, `read_at`, `actor_user_id`, `created_at`. RLS: cada usuario ve/edita solo las suyas.

### 1.5 Campos de pipeline/ancla en `incident` (fuera del dominio pero clave para Evolución)
`transformation_candidate` (bool), `transformation_score` (num), `transformation_decision` (to_evolution/approved_to_evolution…), `status = in_evolution` (ancla §0), y dimensiones: `affected_product_id`, `affected_service_id` (sistema), `affected_process_id`, `affected_business_unit_id` (área), `affected_channel_id`, `category_id`, `reported_by_user_id`.

---

## 2. Funciones SQL (RPCs) del dominio

| Función | Seguridad | Uso |
|---|---|---|
| `converted_cases()` | DEFINER · gate `project.read`/`incident.read` | Casos convertidos (pipeline) con toda su info dimensional (pantalla Casos convertidos). |
| `incident_behavior_analysis(dim, semanas)` | DEFINER · gate `analytics.read` | Análisis agregado de comportamiento de casos + tendencia + proyección + señales causa-raíz. |
| `vendor_scorecard()` | DEFINER · gate `vendor.read` | Señales agregadas por proveedor (sistemas, incidencias, alertas, disputas, vencimiento). |
| `notify_role(rol, tipo, …)` | DEFINER | Fan-out de notificaciones a los usuarios de un rol (campanita). |
| `analytics_overview()` | INVOKER | Resumen ejecutivo (incidencias, proyectos, cambios, CSAT, tendencia). |
| `performance_metrics()` | — | Métricas por área/squad/persona/servicio (Analítica). |
| `project.wsjf` | columna derivada | (valor+criticidad+riesgo)/tamaño. |

---

## 3. Sidebar, pantallas y usos (rol Gerente de Evolución)

Navegación de persona (`EVOLUTION_NAV`, 4 bloques). Cada item reusa el permiso real.

### Bloque EVOLUCIÓN
| Pantalla | Ruta | Permiso | Uso |
|---|---|---|---|
| Portafolio (tablero) | `/projects` | `project.read` | Kanban de proyectos (propuestos/en ejecución/cerrados) + convertir recomendaciones. |
| Portafolio (cockpit) | `/projects/portafolio` | `project.read` | WSJF desglosado, ROI estimado vs real, roadmap, capacidad por squad con drill-down a proyectos. |
| Casos convertidos | `/casos-convertidos` | `project.read`/`incident.read` | Trazabilidad incidencia→mejora/proyecto; agrupación por concepto + gráficos dinámicos. |
| Squads | `/squads` (detalle `/squads/[id]`) | `squad.read` | Equipos, roster, capacidad; categoría Equipo transversal vs Squad dedicado. |
| Capacidad (Recursos) | `/workload` | `squad.read` | Cruce recurso × trabajo (con squad + badge Transversal), capacidad por squad, simulación. |
| Talento | `/talent` (detalle `/talent/[id]`) | `talent.read` (edición `talent.manage`) | Profesionales: perfil, competencias, experiencia, evaluaciones (CRUD §10). |
| Proveedores | `/vendors` | `vendor.read` (gestión `vendor.manage`) | Lista + Scorecard de proveedores. |

### Bloque GOBIERNO Y ANÁLISIS
| Pantalla | Ruta | Permiso | Uso |
|---|---|---|---|
| Análisis de comportamiento | `/analytics/comportamiento` | `analytics.read` | Comportamiento agregado de casos, proyección y señales de causa-raíz. |
| Analítica | `/analytics` | `analytics.read` | Resumen ejecutivo. |
| AI Center | `/ai-center` | `ai.read` | Gobierno de agentes IA. |
| Motor de reglas | `/rules` | `rule.read` | Reglas de transformación / decisión de recomendaciones (RC). |
| Workflows | `/workflows` | `workflow.read` | Definiciones e instancias (solo lectura para Evolución). |
| Arquitectura | `/processes` | `process.read` | Procesos. |
| Conocimiento | `/knowledge` | `knowledge.read` | Base de conocimiento. |

### Bloque CASOS Y COORDINACIÓN
| Pantalla | Ruta | Permiso | Uso |
|---|---|---|---|
| Incidentes mayores | `/major-incidents` | `major_incident.manage` | War-room, accionable por ambas áreas (migración 0092). |
| Problemas | `/problems` | `problem.read` | Solo lectura (badge). |
| Cambios / CAB | `/changes` | `change.read` (+`change.approve`) | Lee y aprueba CAB; no crea. |

### Bloque AYUDA
| Pantalla | Ruta | Permiso | Uso |
|---|---|---|---|
| Catálogo de servicios | `/service-catalog` | `service_catalog.read` | Solicitudes propias. |
| Autoservicio | `/portal` | libre | Portal de usuario. |

### Elementos globales
- **Campanita** (header): notificaciones entre roles (v1: caso derivado / recomendación aprobada → Evolución).
- **Caso de origen** (en detalle de proyecto): panel read-only con estado, fechas y el hilo de comunicación con el cliente (§0), sin `incident.read`.

---

## 4. Notas para el análisis
- La segregación de casos individuales es **capa de aplicación** (nav/guard/server actions); la RLS de `incident` es solo por `tenant_id`. Las vistas del rol que necesitan datos de caso se sirven por **RPC `SECURITY DEFINER` gateado + agregado o acotado al pipeline** (nunca el universo de casos).
- Migraciones del dominio: `0091` (RBAC), `0092` (MI), `0093` (comportamiento), `0094` (ROI real), `0095` (vendor scorecard), `0096` (notificaciones), `0097` (email único talento), `0098` (casos convertidos).
