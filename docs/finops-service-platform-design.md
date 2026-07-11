# FinOps Service Intelligence Platform — Diseño

CredixNexus evolucionando hacia una plataforma de **service intelligence para fintech**:
no una ticketera, sino un sistema nervioso operativo donde cada interacción se vuelve un
**caso trazable, priorizable, auditable, medible, automatizable y enriquecido por IA**.

## 1. Visión
De la operación diaria → inteligencia de transformación. Un caso conecta solicitante, cliente,
producto, transacción, canal, sistema, SLA, riesgo, evidencia, conocimiento, causa raíz,
impacto financiero, decisión y bitácora inmutable. La IA propone; el humano decide.

## 2. Módulos implementados (rutas)
- **Landing** `/` (marca) · **Login** admin · **Dashboard** `/dashboard`.
- **Casos/Incidentes** `/incidents` (case management ITIL + **fintech**): CRUD, SLA,
  categoría→gestión, prioridad, **campos financieros** (case_type, amount, currency,
  transaction_reference, risk_score, sensitive/pii flags, customer con **enmascaramiento PII**),
  detalle 3-zonas (contexto / trabajo / **inteligencia IA**), RCA-IA, KB sugerido, perfil idóneo.
- **Motor de reglas** `/rules` (priorización inteligente + decisión + recomendaciones RC).
- **Proyectos/Evolución** `/projects` (WSJF + ROI + conversión desde caso + caso de negocio IA).
- **Recursos & Carga** `/workload` (distribución, capacidad, **simulación de asignación**).
- **Talento** `/talent` (habilidades, experiencia, **recomendador de perfil idóneo**, desempeño RLS-restringido).
- **AI Center** `/ai-center` (5 agentes gobernados + bitácora `agent_action` + guardrails).
- **Ledger inmutable** `/ledger` (verificación criptográfica + export evidencia).
- **Datos maestros** `/catalog` (motor CRUD genérico, catálogos + FK).
- **Portal Partner** `/partner` (self-service, RLS estricto, branding).

## 3. Modelo de datos (41 tablas, todas con tenant_id + RLS + auditoría)
Core: `tenant`, `party`, `user_account`, `role`/`permission`/`user_role`, `immutable_audit_event`.
Servicio/CMDB: `service`, `configuration_item`, `channel`, `business_unit`, `process`, `product`.
Caso: **`incident`** (= case, con capa fintech), `incident_comment`, `incident_category`, `sla_policy`.
Conocimiento: `knowledge_article`(+versiones). Motor: `rule`/`rule_version`/`rule_evaluation`,
`project_recommendation`, `governance_item`/`governance_link`. Evolución: `project`(+tasks/links).
Talento: `team_member`, `skill`, `member_skill`, `member_expertise`, `member_evaluation`, `squad`,
`asset_assignment`. IA: `agent_action`. Numeración: `document_sequence`.

## 4. Capa de IA + guardrails
`lib/ai/anthropic.ts` (Claude, server-only, key de entorno). 5 agentes: RCA, explicación de
scoring, borrador KB, caso de negocio, resumen ejecutivo. **Guardrails**: nunca ejecuta acciones
críticas; registra modelo/tokens; requiere revisión humana; PII enmascarada; sin mock (si no hay
key, avisa). Toda acción en `agent_action` + evento en el ledger.

## 5. Seguridad y roles
Multi-tenant por RLS (`current_tenant_id()`). RBAC: 14 roles, 29 permisos, helper
`has_permission` usado en backend + UI (ej. `masterdata.manage`, `talent.read`). Datos sensibles
(desempeño) gateados por permiso. PII enmascarada en UI.

## 6. Pendientes (roadmap fintech, no en esta iteración)
- Fintech: campos financieros en el **alta** del caso (hoy: modelo + seed + detalle + lista).
- Customer 360 operativo · service_item enriquecido · portal interno.
- `risk_event` (riesgo operativo) · `problem` (problem mgmt) · `change_request` · `vendor` · Major Incident Command.
- Workflow engine (nodos/instancias) · `escalation_rules` · OLA · alertas SLA 75/90.
- Dashboards exec/supervisor/agente · reportes · más features IA (clasificar/sentimiento/similares).
- Tests de integración con BD.

## 7. Principios sostenidos
Fintech-first · auditabilidad total (ledger) · configurable (catálogos/reglas versionados) ·
IA asistida no autónoma · multi-tenant · **cero mock / cero hardcode** (todo desde la BD).
Ver `docs/gap-assessment.md` para el detalle existente vs. brecha.
