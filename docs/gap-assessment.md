# Gap Assessment — CredixNexus → FinOps Service Intelligence Platform

Evaluación del prototipo actual (CredixNexus, plataforma ITSM+Transformación audit-grade)
contra la visión "FinOps Service Intelligence Platform / NexDesk Fintech Service Cloud".

**Hallazgo clave:** ~70% de la base estructural ya existe con naming ITSM/ITIL. El `incident`
es de facto el **case**; `service`/`configuration_item` cubren catálogo/CMDB; `rule_engine`
cubre priorización inteligente; el `immutable_audit_event` cubre auditabilidad total; RLS +
roles + permisos cubren multi-tenant y RBAC; la capa `agent_action` + `lib/ai` cubre IA
gobernada. La brecha real es la **capa fintech** (tipos de caso, campos financieros, customer
360, riesgo operativo, change/vendor) y algunos módulos de superficie (AI Center, portal).

Leyenda estado: ✅ existe · 🟡 parcial · 🔴 falta.

| # | Área (visión) | Estado | Existente en el repo | Acción / Pendiente | Prioridad |
|---|---|---|---|---|---|
| 4.1 | Portal autoservicio | 🟡 | `/partner` (portal partner con branding + tickets + self-service) | Extender a portal interno + búsqueda + catálogo + encuesta CSAT | Alta |
| 4.2 | Catálogo de servicios | 🟡 | `service` (9) + `configuration_item` | Enriquecer service_item (form_schema, requires_approval, risk_level, workflow) + servicios fintech | Alta |
| 4.3 | Ticketing / Case Mgmt | 🟡→✅ | `incident` (case), `incident_comment`, categoría, SLA, prioridad ITIL | **Extender con campos fintech** (case_type, amount, currency, transaction_ref, severity, risk_score, sensitive/pii flags) | **Crítica** |
| 4.4 | Workspace del agente | 🟡 | `/incidents` lista + detalle 3-zonas (contexto/trabajo/inteligencia IA) | Vistas "mis casos / sin asignar / en riesgo SLA" + colas | Alta |
| 4.5 | Workflows no-code | 🟡 | `rule`/`rule_version` (motor de decisión configurable + versionado) | Motor de workflow con nodos/instancias/pasos | Media |
| 4.6 | SLA / OLA / escalación | 🟡 | `sla_policy` + targets automáticos + breach en UI | OLA + escalation_rules + alertas 75/90/vencido | Media |
| 4.7 | Knowledge base | ✅ | `knowledge_article` + versiones + sugerencia por categoría/CI + draft IA | Tipos (runbook/known-error) + feedback útil/no-útil + deflection | Media |
| 4.8 | IA / Copilotos | ✅ | `lib/ai` (5 agentes: RCA, scoring, KB, business case, exec summary) + `agent_action` (log gobernado) | **AI Center** (superficie) + más features (clasificar, sentimiento, similares) | Alta |
| 4.9 | Customer 360 | ✅ | `/customers` lista + `/customers/[id]` vista 360 (identidad enmascarada, segmento/VIP/riesgo, casos, productos, alertas) + link desde el caso | Enriquecer con productos/cuentas del core | Media |
| 4.10 | Riesgo operativo | 🔴 | — (incident tiene financial_impact) | Tabla `risk_event` + flujo desde caso | Media |
| 4.11 | Problem / RCA | 🟡 | RCA-IA en caso + root_cause_summary; sin tabla problem | Tabla `problem` + link multi-caso | Media |
| 4.12 | Change Management | 🔴 | project/change conceptual; sin tabla change_request | Tabla `change_request` + CAB | Baja |
| 4.13 | Major Incident | 🟡 | prioridad P1 + estados; sin command center | Vista war-room + estados MI | Baja |
| 4.14 | Vendor Mgmt | 🔴 | `configuration_item` (external_system) parcial | Tabla `vendor` + link a casos | Baja |
| 4.15 | Dashboards/Reportes | 🟡 | `/dashboard` (KPIs) + gráficos en incidentes/recursos | Dashboards exec/supervisor/agente + reportes | Media |
| 5 | Navegación | 🟡 | sidebar 9 módulos | Agrupar Fintech Ops / Technology / Admin / AI Center | Media |
| 6 | Permisos RBAC | ✅ | 14 roles, 29 permisos, `has_permission`, RLS por tenant | Roles fintech (Risk/Change/Vendor Mgr) | Baja |
| 7 | Multi-tenant / datos | ✅ | 41 tablas con tenant_id + RLS + auditoría + ledger inmutable | Mantener patrón | — |
| — | Landing + auth admin | ✅ | landing de marca `/` + login admin verificado | — | — |
| — | Pruebas | 🟡 | Vitest, 28 tests (validación/prioridad/ROI) | Tests de integración con BD | Media |

## Increment implementado en esta iteración (§16 prioridad 1, 5, 8)

1. **Modelo de caso fintech** (`incident` extendido): `case_type`, `amount`, `currency`,
   `transaction_reference`, `severity`, `risk_score`, `sensitive_flag`, `pii_flag`,
   `customer_name` (denorm enmascarable). + categorías y servicios fintech + casos demo.
2. **AI Center** (`/ai-center`): superficie de los 5 agentes IA + bitácora `agent_action`
   (modelo, tokens, revisión humana) — IA gobernada y visible.
3. **Sección Fintech/Financiero** en el detalle del caso + campos en el alta.
4. Docs: este gap + `docs/finops-service-platform-design.md`.

## Roadmap siguiente (por fase, no en esta iteración)
- F-Fin1: Customer 360 operativo + service_item enriquecido + portal interno.
- F-Fin2: Riesgo operativo (`risk_event`) + Problem Management (`problem`).
- F-Fin3: Workflow engine (nodos/instancias) + escalation_rules + OLA.
- F-Fin4: Change Mgmt + Major Incident Command + Vendor Mgmt.
- F-Fin5: Dashboards exec/supervisor + reportes + más features IA (clasificar/sentimiento/similares).
