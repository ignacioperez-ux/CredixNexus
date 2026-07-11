# CredixNexus — Functional Gap Assessment vs. benchmark ITSM/ESM/Fintech

Benchmark: capacidades consolidadas de **ServiceNow · Zendesk · InvGate · EasyVista**, evaluadas
contra el estado real del repositorio (verificado en código + esquema Supabase, no inferido).

Leyenda: ✅ existe y usable · 🟡 parcial / preparado · 🔴 falta.

## 1. Resumen ejecutivo

CredixNexus **ya es** una plataforma de servicio fintech integrada, no una ticketera. De las 18
áreas del diseño objetivo, **15 están completas (✅)** y **3 parciales (🟡)**; ninguna crítica falta.
El `incident` es el **caso central** (case anchor) con dimensiones fintech (monto, transacción,
cliente, riesgo, PII/sensibilidad) y flujos especializados anclados (fraude, disputa, riesgo,
problema, cambio, incidente mayor, solicitud de catálogo). Todo es multi-tenant con RLS, auditado en
un **ledger inmutable (hash-chaining)**, e i18n ES/EN. Las brechas restantes son de **madurez**
(SSO/MFA, colas formales, editor visual de workflow, hub de administración, adjuntos/notificaciones),
no de núcleo funcional.

Esta iteración cierra la brecha de **navegación** (antes 🟡): el sidebar se reagrupó en 6 dominios
alineados al benchmark (Operación · Fintech Ops · Tecnología · Conocimiento & IA · Evolución &
Talento · Gobierno & Datos) sin agregar ni quitar rutas.

## 2. Arquitectura actual encontrada

- **Next.js 16 (App Router) + React 19 + TypeScript**, Tailwind v4, design system propio (tokens en
  `app/globals.css`, dos temas). Monolito modular (no microservicios): los bounded contexts de la
  spec son módulos `app/(app)/<modulo>` + esquemas/funciones Postgres.
- **Supabase**: Postgres 17, Auth, **RLS por `current_tenant_id()`**, RBAC por `has_permission()`.
  ~55 tablas con `tenant_id`, auditoría por trigger `audit_row_change` → `immutable_audit_event`.
- **Capas**: `lib/<modulo>/{queries,actions,validation}` (validación pura testeable) → `components/`
  → páginas. 65 migraciones (`sql/0001`–`0065`). **179 pruebas** (Vitest), build limpio.
- **IA gobernada**: `lib/ai` (Anthropic real, degrada sin key, cero mock) + `agent_action` (bitácora).

## 3. Matriz de evaluación por área

| # | Área (benchmark) | Estado | Existe en el repo | Brecha / acción |
|---|---|---|---|---|
| 6.1 | Identity, Tenant & Security | ✅ | tenant(`operating_mode`), 14 roles, permisos + `has_permission`, RLS multi-tenant, PII masking (`maskName/TaxId/Email/Phone`), flags `sensitive/pii`, ledger de auditoría | 🟡 SSO/MFA (prep), colas formales, roles benchmark faltantes (fraud_analyst, dispute_analyst, incident_commander, approver, executive_viewer) |
| 6.2 | Omnichannel Intake | 🟡 | `incident.source_channel`, `digital_experience_event` (canales web/mobile/api/ivr/whatsapp), AI classify | 🔴 intake_rules / classification_rules / duplicate_detection formales; routing por canal |
| 6.3 | Portal de autoservicio | ✅ | `/portal` (búsqueda NL, KB + casos, deflection, crear caso, feedback) | — |
| 6.4 | Service Catalog | ✅ | `/service-catalog` + `service_item` (form_schema dinámico, SLA, workflow) + **constructor visual de formularios** + `service_request` anclado | — |
| 6.5 | Case Management (central) | ✅ | `incident` = caso; fintech: case_type, amount, currency, transaction_reference, customer_name, risk_score, sensitive/pii, financial_impact, delivery_area | 🟡 faltan campos: country/company, card/merchant_reference, first_response timers, resolution_code, root_cause_code, evidence_complete |
| 6.6 | Vista 360 del caso | ✅ | `incident-detail` 3 zonas: contexto · trabajo (comentarios int/ext, timeline, ledger) · inteligencia (RCA-IA, KB, casos similares, fit talento, riesgo, vendor, MI, problema, cambio, flujo financiero, CSAT) | Fuerte. 🟡 adjuntos, checklist de tareas formal |
| 6.7 | Agent Workspace | ✅ | `/workspace` colas: mis casos, sin asignar, P1/P2, en riesgo SLA, por admitir, reabiertos, sensibles, alto impacto | — |
| 6.8 | Workflow Studio | ✅ | motor no-code (`workflow_definition/version/instance/step`), entity_type request/incident/problem/change/project, `start_workflow` atómico | 🟡 editor visual de nodos (canvas drag-drop) |
| 6.9 | SLA / OLA / XLA | ✅ | `/sla-governance` (OLA + escalation_rules + alertas 75/90/vencido), CSAT/XLA (`case_survey` + dimensiones área/servicio/agente) | — |
| 6.10 | Knowledge Management | ✅ | KB viva: tipos (how_to/runbook/known_error/faq/policy), feedback útil/no-útil, deflection/escalation, versiones, draft IA desde caso | — |
| 6.11 | AI Center | ✅ | `/ai-center`, agentes (RCA, clasificar, sentimiento, similares, KB, business case, exec summary, portal assist), `agent_action` (modelo, confianza, revisión humana), guardrails | 🟡 versionado de prompts, apagar IA por tenant/módulo |
| 6.12 | Customer 360 | ✅ | `/customers` + `/customers/[id]` (identidad enmascarada, segmento/VIP/riesgo, productos, casos, alertas) + chip en el caso | 🟡 transacciones del core |
| 6.13 | Fintech Operations | ✅ | riesgo, fraude, disputas; pagos/tarjetas como categorías/servicios + casos demo | 🟡 pantallas dedicadas payments/cards (hoy vía catálogo/casos) |
| 6.14 | Risk, Fraud & Disputes | ✅ | `risk_event`, `fraud_case`, `dispute_case` (máquinas de estado, montos expuesto/recuperado, PII enmascarada, anclados al caso) | — |
| 6.15 | ITSM / Technology Ops | ✅ | incidentes, major incident (war-room), problemas (known error, workaround), cambios (CAB), RCA | — |
| 6.16 | CMDB / Dependency Graph | ✅ | `/cmdb` (service, configuration_item, ci_relationship) + `/dependencies` (service_dependency + blast radius derivado de casos reales) | — |
| 6.17 | Observability / Service Health | ✅ | `/observability` (`monitoring_alert` + `digital_experience_event`) + crear/correlacionar caso desde alerta | — |
| 6.18 | Reporting & Analytics | ✅ | `/analytics` (exec dashboard, performance por área/squad/agente/servicio con CSAT, reportes exportables) | 🟡 dashboards por rol (agente/supervisor) diferenciados |
| 7 | Navegación | ✅ (esta iteración) | sidebar reagrupado en 6 dominios benchmark | — |
| — | Gobierno de datos | ✅ | `/processes` (ficha de proceso + matrices proceso↔sistema, producto↔canal), `governance_item`, ledger | — |

## 4. Brechas de usabilidad

1. **Navegación** — 🟢 resuelto: de 2 grupos de ~15 a 6 grupos temáticos ≤9 ítems.
2. **Colas / routing** — no hay entidad `queue` formal ni reglas de asignación por cola (hoy:
   `delivery_area` + triage + workspace buckets). Media prioridad.
3. **Adjuntos y checklist de tareas** en el caso — el timeline y comentarios existen; falta subida de
   evidencia y checklist estructurado. Media.
4. **Hub de administración unificado** — usuarios/roles/equipos se gestionan por datos maestros y SQL;
   no hay `/admin` con UI de altas de usuario/rol. Media.

## 5. Brechas de modelo de datos

Preparadas pero no completas (todas no bloqueantes):
- `case` fields: `country_id`, `company_id`, `card_reference`, `merchant_reference`,
  `first_response_due_at/at`, `resolution_code`, `root_cause_code`, `evidence_complete`.
- Entidades: `queue`, `case_attachment`, `case_task` (checklist), `notification`, `intake_rule`,
  `xla_metric` explícito (hoy CSAT), `ai_prompt_version`.

## 6. Brechas de IA

Núcleo cubierto (agentes + bitácora + guardrails). Falta: **versionado de prompts**, **toggle de IA
por tenant/módulo**, evaluación de calidad de output, y copilotos de **supervisor** y **gobierno**
como superficies dedicadas (las funciones existen; falta la vista agregada).

## 7. Brechas de reporting

Dashboards **ejecutivo** y **performance** existen. Faltan vistas diferenciadas **por rol**
(supervisor: carga/reaperturas/cuellos; agente: mis SLAs/tareas) — datos ya disponibles, es
superficie.

## 8. Acciones implementadas en esta iteración

- **Reorganización de navegación** (`components/app-shell/sidebar.tsx` + i18n): 6 grupos benchmark
  (Operación · Fintech Ops · Tecnología · Conocimiento & IA · Evolución & Talento · Gobierno & Datos),
  **conservando las 30 rutas** (§16: no romper, refinar). Build ✅ · tests **179/179** ✅.
- Documentación: este archivo + `docs/credixnexus-integrated-design.md`.

## 9. Pendientes priorizados (siguiente iteración)

| Prioridad | Ítem | Esfuerzo |
|---|---|---|
| Alta | Adjuntos + checklist de tareas en el caso (`case_attachment`, `case_task`) | Medio |
| Alta | Dashboards por rol (supervisor/agente) sobre datos existentes | Bajo |
| Media | Colas formales (`queue`) + reglas de asignación | Medio |
| Media | Campos de caso faltantes (resolution/root_cause codes, first_response timers, evidence_complete) | Bajo |
| Media | Hub de administración (`/admin`: usuarios, roles, equipos) | Alto |
| Media | Intake omnicanal (`intake_rule`, duplicate detection) | Medio |
| Baja | Editor visual de workflow (canvas de nodos) | Alto |
| Baja | Versionado de prompts IA + toggle por tenant | Medio |
| Baja | Notificaciones (`notification` + centro de notificaciones) | Medio |

Ninguno bloquea la operación diaria; el núcleo está completo y usable.
