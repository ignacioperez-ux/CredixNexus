# Gap Assessment — Visión "Fintech Service & Operations Intelligence Platform"

Evaluación del prototipo **CredixNexus** contra la instrucción inspirada en plataformas
tipo EASYVISTA (ITSM/ESM/ITOM unificado). Objetivo: tomar **lo bueno** del modelo e
integrarlo en lo ya construido para una herramienta más robusta, completa, **100%
audit-grade** y orientada a la **satisfacción del usuario** de Credix.

**Hallazgo clave:** ~85% de la visión ya está implementada con integridad (RLS multi-tenant,
ledger inmutable con hash-chaining, RBAC, validación en 3 capas, i18n ES/EN, pruebas). Las
brechas reales son unos pocos módulos de superficie y capas de observabilidad/experiencia.

Leyenda: ✅ existe · 🟢 existe (equivalente) · 🟡 parcial · 🔴 falta.

| # | Área (visión) | Estado | Qué existe hoy en CredixNexus | Brecha / Integración |
|---|---|---|---|---|
| 4.1 | Portal autoservicio omnicanal | 🟡 | `/partner` (portal partner: branding, tickets, self-service) | Portal interno `/portal` con buscador NL, catálogo, "mis solicitudes", artículos, estado de servicios |
| 4.2 | Catálogo de servicios avanzado | 🟡 | `service` (catálogo con criticidad/dominio) + `case_type` (16 tipos fintech) | `service_item` enriquecido: form_schema, requires_approval, default_sla, workflow_id, evidence_required |
| 4.3 | Case Management fintech | ✅ | `incident` = case anchor; case_type fintech (Dispute, Chargeback, FraudSuspicion, PaymentIssue…); prioridad ITIL, severidad, impacto/urgencia, campos financieros, sensitive/PII | Completo. Extensible a subtipos |
| 4.4 | Vista 360 del caso | ✅ | `/incidents/[id]` 3 zonas (contexto/trabajo/inteligencia): SLA, escalaciones, KB, IA (RCA/sentimiento/similares/clasificar), riesgo, problema, cambio, incidente mayor, proveedor, área, admisión, esfuerzo | Completo |
| 4.5 | Agent Workspace | ✅ | **`/workspace`** (nuevo): mis casos, sin asignar, críticos, SLA en riesgo, por admitir, reabiertos, sensibles, alto impacto | Implementado en esta iteración |
| 4.6 | Workflow & Orchestration | ✅ | Motor `workflow_definition/node/edge/instance/step` + aprobaciones + constructor + pipeline Evolución con compuerta QA | Falta canvas visual drag-drop (constructor por formulario existe) |
| 4.7 | SLA / OLA / XLA + escalación | 🟡 | `sla_policy`, `ola_policy`, `escalation_rule` (75/90/vencido) + motor de evaluación | **XLA/CSAT** (experiencia/satisfacción) — brecha clave para "satisfacción del usuario" |
| 4.8 | Knowledge Management vivo | 🟢 | `knowledge_article` + sugerencia por categoría/CI + borrador IA + chequeo en admisión | Tipos (runbook/known-error) + feedback útil/no-útil + métrica de deflection |
| 4.9 | AI Center / Copilotos | ✅ | `lib/ai` (clasificar, sentimiento, similares, RCA, resumen ejecutivo, business case, explicar score) + bitácora `agent_action` (modelo, confianza, revisión humana) | Guardrails y log completos. Falta búsqueda semántica |
| 4.10 | Observability Center | 🔴 | — | `monitoring_alert` + `digital_experience_event` + crear caso desde alerta (sensor→workflow→action) |
| 4.11 | Discovery / CMDB / Dependency Graph | 🟡 | `configuration_item` (`/cmdb`, apps/sistemas) + vendor por CI | `service_dependency` (grafo de dependencias) + impacto en caso |
| 4.12 | Riesgo operativo | ✅ | `risk_event` (pérdida est./real/recuperada, plan, categoría) + flujo desde caso | Completo |
| 4.13 | Fraude | 🟡 | case_type `FraudSuspicion` + riesgo | `fraud_case` dedicado (señales, decisión, pérdida/recuperación, investigador) |
| 4.14 | Disputas / contracargos | 🟡 | case_type `Dispute`/`Chargeback` | `dispute_case` dedicado (procesador, plazos, evidencia, decisión) |
| 4.15 | Major Incident Command | ✅ | `major_incident` + war-room + timeline de comunicaciones + severidad/mando | Completo |
| 4.16 | Problem Management / RCA | ✅ | `problem` + link multi-caso + error conocido + workaround | Completo |
| 4.17 | Change Management | ✅ | `change_request` + CAB + máquina de estados + tipos + vínculo incidente/problema | Completo |
| 4.18 | Vendor Management | ✅ | `vendor` + criticidad + contrato + CIs + incidentes por proveedor | Completo |
| 4.19 | Dashboards y reportes | ✅ | `/analytics` (ejecutivo + **rendimiento** por persona/squad/área + reportes con filtros/CSV) + `/dashboard` (inventario clickeable) | Completo |
| 5 | Navegación | ✅ | Sidebar por grupos (Operación / Gobierno & Datos) con 25+ módulos | Ajustar al crecer |
| 6 | RBAC | ✅ | 14 roles, ~50 permisos, `has_permission`, RLS por tenant, PII enmascarada | Completo (ABAC parcial vía flags sensitive/PII) |
| 7 | Multi-tenant / auditoría | ✅ | Todas las tablas con `tenant_id` + RLS + auditoría (ledger inmutable hash-chaining) | Completo |
| — | Áreas de entrega + ruteo | ✅ | `delivery_area` (Operaciones/Evolución) + ruteo automático + líderes | Completo |
| — | Squads + roster | ✅ | `squad_member` (función/asignación) + capacidad | Completo |
| — | Admisión/triage | ✅ | admitir/descartar (siempre registra) + clasificar + chequeo KB + ruteo | Completo |
| — | Medición (tiempo/calidad) | ✅ | `performance_metrics` + `case_work_log` (esfuerzo por caso) | Completo |

## "Lo bueno" del modelo — integraciones priorizadas (siguiente fase)

Ordenado por valor para robustez + satisfacción del usuario, manteniendo integridad §10:

1. **CSAT / XLA (satisfacción)** 🔴 → encuesta al cierre del caso + métrica de experiencia por
   servicio/área/agente. *Directamente "orientado a la satisfacción del usuario".*
2. **Agent Workspace** ✅ → hecho en esta iteración.
3. **Observability Center** 🔴 → `monitoring_alert` + crear/correlacionar caso desde alerta
   (lógica sensor→workflow→action) + `digital_experience_event`.
4. **Portal de autoservicio interno** 🟡 → `/portal` con búsqueda en lenguaje natural (reusa
   `classifyIncident` de IA), catálogo, mis solicitudes, estado de servicios.
5. **Dependency Graph / CMDB** 🟡 → `service_dependency` + impacto de un caso en servicios/productos.
6. **Fraude y Disputas dedicados** 🟡 → `fraud_case` y `dispute_case` colgando del caso ancla.
7. **KB viva** 🟢 → feedback útil/no-útil + deflection + tipos runbook/known-error.
8. **Service Catalog avanzado** 🟡 → `service_item` con form_schema/SLA/workflow por servicio.

Ninguna de estas requiere reconstruir lo existente: son extensiones que cuelgan del `incident`
(case anchor), del `delivery_area`, del motor de workflow y de la analítica ya construidos.
