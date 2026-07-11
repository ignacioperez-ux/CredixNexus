# CredixNexus — Integrated Design (visión de producto integrada)

Documento vivo. Describe qué es CredixNexus como **plataforma fintech de inteligencia de servicio**
integrada (no una colección de pantallas), sus principios, módulos, modelo de datos, rutas,
workflows, IA, seguridad y roadmap.

## 1. Visión del producto

> CredixNexus no es una mesa de ayuda. Es la plataforma de operación fintech donde **cada caso
> conoce su contexto**: quién lo pidió, qué producto y transacción toca, cuánto dinero está en
> juego, qué riesgo genera, qué SLA corre, quién debe resolverlo, qué workflow aplica, qué
> conocimiento existe, qué recomienda la IA y qué evidencia queda para auditoría.

Combina la profundidad enterprise (ServiceNow), la simplicidad de agente (Zendesk), la orientación
ITSM/ESM moderna (InvGate) y la observabilidad/orquestación (EasyVista), sobre una **capa fintech
propia**: cliente, producto, transacción, riesgo, fraude, disputa, impacto financiero, proveedor.

## 2. Principios de diseño (no negociables)

1. **El caso es el centro.** El `incident` es el ancla; todo flujo especializado (fraude, disputa,
   riesgo, problema, cambio, incidente mayor, solicitud) cuelga de él y **la mesa nunca pierde el
   tracking** (client-centric extremo a extremo).
2. **Audit-grade absoluto.** Ninguna mutación de negocio existe sin su `immutable_audit_event`; las
   operaciones que crean caso + registro dependiente son **atómicas** (todo o nada).
3. **Multi-tenant desde el origen.** Todo dato operativo lleva `tenant_id` + RLS por
   `current_tenant_id()`.
4. **Cero hardcode / cero mock.** Todo valor de negocio sale de la BD real; la topología no se
   inventa (se declara o se deriva de señal real: casos, co-ocurrencia).
5. **IA asiste, el humano decide.** La IA sugiere y se registra (`agent_action`); nunca ejecuta
   acciones críticas ni cruza tenants.
6. **Configurable y versionado.** Catálogos, reglas, formularios, fichas y matrices absorben cambios
   sin rediseño.
7. **Integralidad sobre cantidad.** Se mejora lo existente antes de crear pantallas; el producto se
   siente como uno solo.

## 3. Módulos actuales (todos productivos)

**Operación:** Dashboard · Mi trabajo (workspace) · Casos (incidents + 360) · Admisión (triage) ·
SLA/OLA/XLA · Clientes (360) · Analítica · Portal autoservicio · Portal partner.
**Fintech Ops:** Fraude y disputas · Riesgo operativo · Catálogo de servicios.
**Tecnología:** Incidentes mayores · Problemas · Cambios (CAB) · Observabilidad · Dependencias
(blast radius) · Proveedores.
**Conocimiento & IA:** KB viva · AI Center · Reglas (scoring/decisión) · Workflows.
**Evolución & Talento:** Proyectos (Evolución) · Squads · Talento · Recursos/carga.
**Gobierno & Datos:** Procesos (fichas + matrices RACI) · Áreas de entrega · Ledger inmutable ·
Datos maestros.

## 4. Módulos objetivo (madurez futura)

Adjuntos + checklist de tareas en el caso · Dashboards por rol (supervisor/agente) · Colas formales +
routing · Hub de administración (usuarios/roles/equipos/integraciones) · Intake omnicanal con reglas ·
Editor visual de workflow · Versionado de prompts IA + toggle por tenant · Notificaciones.

## 5. Modelo de datos conceptual (mapa a lo real)

| Concepto benchmark | Entidad real en CredixNexus |
|---|---|
| tenants / companies / countries | `tenant` (operating_mode), `business_unit` |
| users / roles / permissions | `user_account`, `role`, `permission`, `role_permission` |
| teams / queues | `squad`, `delivery_area`, `team_member` (colas = buckets de workspace) |
| service_categories / service_items / forms | `service_item` (form_schema), `incident_category` |
| workflow_* | `workflow_definition/version/instance/step` |
| cases / comments / tasks / approvals / history | `incident`, `incident_comment`, ledger (history) |
| sla / ola / xla | `sla_policy`, `escalation_rule`, `case_survey` (XLA/CSAT) |
| knowledge_* | `knowledge_article/version/feedback/event` |
| customers / products / transactions | `party`, `product`, `channel`, refs en `incident` |
| vendors / vendor_services | `vendor`, `configuration_item.vendor_id` |
| configuration_items / service_dependencies | `configuration_item`, `ci_relationship`, `service_dependency` |
| monitoring_alerts | `monitoring_alert`, `digital_experience_event` |
| risk / fraud / dispute | `risk_event`, `fraud_case`, `dispute_case` |
| incidents / major / problems / changes | `incident`, `major_incident`, `problem`, `change_request` |
| ai_interactions | `agent_action` |
| audit_logs | `immutable_audit_event` (hash-chained) |
| processes / matrices | `process`, `process_system`, `product_channel` |

Brechas de modelo (preparar): `queue`, `case_attachment`, `case_task`, `notification`,
`intake_rule`, `ai_prompt_version`; campos de caso (country/company, card/merchant ref,
first_response timers, resolution/root_cause codes, evidence_complete).

## 6. Rutas / pantallas

`/dashboard · /workspace · /incidents(+/[id]) · /triage · /sla-governance · /customers(+/[id]) ·
/analytics · /portal · /partner · /fraud-disputes(+/fraud|dispute/[id]) · /risk · /service-catalog
(+/requests/[id]) · /major-incidents(+/[id]) · /problems(+/[id]) · /changes(+/[id]) · /observability ·
/dependencies · /vendors(+/[id]) · /knowledge(+/[id]) · /ai-center · /rules · /workflows(+/[id]) ·
/projects(+/[id]) · /squads(+/[id]) · /talent · /workload · /processes(+/[id]) · /delivery-areas ·
/ledger · /catalog · /cmdb`.

## 7. Workflows

Motor no-code (`start_workflow`/`advance_workflow_step`, atómico, auditado), entity_type
incident/problem/change/project/request/generic. Disparo desde catálogo de servicios (item →
workflow). Nodos objetivo (canvas visual pendiente): form, condition, human task, approval (secuencial/
paralela/por monto/por riesgo), timer, SLA pause/resume, assign, change status, create task/subcase,
API/webhook, AI classify/summarize/recommend, error/retry/rollback.

## 8. IA y guardrails

`lib/ai` (Anthropic real; degrada a búsqueda/keyword sin key — cero mock). Funciones: classify,
summarize, suggest priority/assignment, KB, similar cases, sentiment, RCA, business case, exec
summary, portal assist. **Guardrails**: no ejecuta acciones críticas, requiere aceptación humana,
enmascara PII, registra en `agent_action` (modelo, confianza, input/output, revisión requerida).
Pendiente: versionado de prompts, toggle por tenant/módulo, evaluación de calidad.

## 9. Seguridad y roles

RLS por tenant en toda tabla operativa; RBAC por `has_permission(code)`; 14 roles + permisos por
recurso/acción. PII enmascarada en UI y logs. Segregación: la IA y los agentes no cruzan tenants ni
auto-aprueban. Pendiente: SSO/MFA, roles benchmark adicionales (fraud/dispute analyst, incident
commander, approver, executive viewer), auditoría de accesos dedicada.

## 10. Reportes

Ejecutivo (salud, P1/P2, SLA, backlog, impacto financiero, fraude/disputa, CSAT, deflection) +
Performance (área/squad/agente/servicio con CSAT/XLA) + Reportes exportables (incidents/changes/
risk/problems). Pendiente: dashboards diferenciados supervisor/agente (superficie sobre datos ya
disponibles).

## 11. Roadmap

1. **Experiencia de caso**: adjuntos + checklist de tareas + campos de cierre (resolution/root_cause,
   evidence_complete).
2. **Control operativo**: dashboards por rol (supervisor/agente); colas formales + routing.
3. **Administración**: hub `/admin` (usuarios, roles, equipos, integraciones, settings).
4. **Intake omnicanal**: `intake_rule` + duplicate detection + normalización de payload por canal.
5. **IA madura**: versionado de prompts, toggle por tenant, copilotos supervisor/gobierno.
6. **Workflow visual**: canvas de nodos drag-drop sobre el motor existente.
7. **Notificaciones**: centro de notificaciones + reglas.

> El núcleo (18 áreas) está completo y usable. El roadmap es madurez y experiencia, no cimientos.
