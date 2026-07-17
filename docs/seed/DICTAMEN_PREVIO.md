# DICTAMEN PREVIO — Limpieza total controlada y repoblado integral

> **Estado:** APROBADO en STOP GATE 0 por el arquitecto (2026-07-15). Los 6 puntos de §0.6
> quedan autorizados.
> **Modo de producción de este documento:** Arquitecto (análisis, sin mutaciones). Sólo
> `SELECT` y catálogo de esquema vía Supabase MCP.
> **Entorno:** `CREDIXNEXUS` · ref `dffbysjrvvlwgzgakhaa` · PostgreSQL 17.6.1.141 ·
> ca-central-1 · `ACTIVE_HEALTHY` · rol `postgres` (`rolbypassrls=true`).
> **Ventana de negocio objetivo:** 2026-01-15 → 2026-07-15.

Etiquetas: **[HECHO]** verificado contra esquema/datos vivos · **[INTERPRETACIÓN]** lectura de
prompt/negocio · **[DECISIÓN]** propuesta aprobada.

---

## 0.1 Entorno — [HECHO]
- Único proyecto/entorno. **82 tablas** en `public`.
- **Tenant operativo:** `CORE = c5d2f057-6262-4275-8ba9-16d9617ce128` (internal, active) — todo el dato vive aquí.
- **Tenant `SAC = 0477116e-90ee-44e8-a489-93cea6dd5210`** (archived) — ver D-9.

---

## 0.2 Esquema vivo — hallazgos que gobiernan el plan

### A) Numeración, SLA, área de entrega y LEDGER son por TRIGGER — [HECHO]
| Concepto | Trigger/función | Efecto |
|---|---|---|
| Numeración | `set_*_number` → `next_document_number(tenant,doc_type,prefix)` | Consume `document_sequence` con `on conflict do update` (auto-crea fila). |
| SLA | `set_incident_sla` (SECDEF) | Deriva due de `sla_policy` por priority (active) sobre `opened_at`; `coalesce` respeta lo provisto. |
| Área | `set_incident_delivery_area`/`set_project_delivery_area` | delivery_area_id NULL ⇒ fuerza `operations`/`evolution`. |
| Encuesta | `enqueue_case_survey` | Sólo `AFTER UPDATE` a resolved/closed con cambio. Insertar directo NO auto-genera. UNIQUE(incident_id). |
| Ledger | `audit_row_change`→`append_audit_event`→`compute_audit_hash` | Cada DML encadena bloque SHA-256 por tenant. |

**Feasibility ledger [HECHO]:** `append_audit_event` hace `height=coalesce(prev,-1)+1` ⇒ con la
tabla vacía el 1er insert es `block_height=0` (génesis auto, sin función aparte). Bajo `postgres`,
`current_setting(...,true)` y `auth.uid()` = NULL ⇒ eventos con `actor_type='system'` sin fallar.
Serializa por `pg_advisory_xact_lock('credix_ledger',tenant)` (repoblado correcto; escritura
secuencial por tenant).

### B) Ledger append-only [HECHO]
`prevent_audit_mutation` bloquea UPDATE/DELETE ⇒ `TRUNCATE` es la única vía de reinicio (no
dispara triggers de fila). Fase 2.3 viable tal cual.

### C) Prefijos de numeración reales ≠ prompt — [HECHO] → **[DECISIÓN D-1, APROBADA]**
doc_type/prefijo vivos (mandan; §1 no altera funciones): incident/`INC`, change/`CHG`,
problem/`PRB`, major_incident/`MI`, project/`PRJ`, dispute/**`DP`**, fraud/**`FR`**, risk/`RSK`,
knowledge/`KB`, workflow/**`WF`**, service_request/**`SR`**, vendor/`VND`. **No existe secuencia
`EVT`.** `document_sequence` se reinicia a **0** con estos **12 doc_type reales**.

### D) Conflictos DATA↔CHECK, resueltos por DATO (sin DDL) — [HECHO] → **[DECISIÓN, APROBADAS]**
- **D-2 channel_type:** DATA (`digital_cliente/atencion/presencial/...`) no válido. Mapeo por fila
  a la lista tech (mobile/web/phone/whatsapp/email/social/chat/assisted/branch/kiosk/portal_partner);
  agrupación de negocio a `metadata`. Los 8 canales existentes ya tienen tipo correcto.
- **D-3 squad_role:** sin `ux`/`architect`. PO→`product_owner`, TL→`tech_lead`, DE/BE→`developer`,
  QA→`qa`, **UX→`analyst`**, **Arquitecto→`tech_lead`**. Disciplina legible en `team_member.discipline`.
- **D-4 escalation action:** sin `escalate`. ESC-*-75/90=`notify`(+notify_role); ESC-*-100=`raise_priority`.
- **D-5 service_category:** codes vivos minúscula `acceso/datos/general`, duplicados ×2. Dedup a 3
  conservando esos codes.
- DX events (`digital_experience_event.channel`) ∈ web/mobile/api/ivr/whatsapp.

### E) Invariantes clave del seed — [HECHO]
incident: intake pending/accepted(→classified_as)/discarded(→discard_reason); resolved/closed_at≥opened_at;
title≥5; transformation_score 0-100. sla/ola: resolution≥response. case_survey: 1-5, submitted⇒score,
UNIQUE(incident). project: initiative_type project/improvement/demand/run; job_size>0. **project_recommendation:
incident_id + rule_evaluation_id NOT NULL** (cadena obligatoria). team_member.delivery_area_id NOT NULL.
vendor: category acotada + codes explícitos.

---

## 0.3 Validación DATA — [HECHO]
Códigos únicos OK (PRODUCTOS 32, CANALES 25, PROCESOS 64, CI 60, SKILL 34, SQUADS 7, TRIBUS 2).
Corrección única: **"Andrey Siolano"→"Andrey Solano"** [DECISIÓN aprobada]. FKs resolubles (BU de
producto, service de service_item, squad de asignación, padre de micro-proceso). `product_channel(101)`
por slug normalizado (sin tildes/case/trim) — **[DECISIÓN D-6]**; pares no resueltos se reportan en Gate 3.
NOT NULL sin default se cubren con defaults de negocio (**[DECISIÓN D-7]**): service_category.name_en=ES,
agent_action.model=anthropic/claude-opus-4, created_by/updated_by NULL (actor sistema).

### Maestros hoy vs objetivo
business_unit 19→18 · channel 8→25 · service 15(incl 6 SVC_*)→12 · service_category 6→3 ·
incident_category 16→16(update) · case_type 16→16(update) · vendor 3→~25 · delivery_area 4→2 ·
escalation_rule 12→6 · document_sequence reset 0 · **rule/rule_version INTOCABLE (TRANSFORM_CREDIX_001 v1)**.

---

## 0.4 Respuestas a los 5 puntos del Gate 0

**(a) Limpieza+carga funciona — Sí [HECHO].** Grafo de 188 FK acíclico salvo auto-refs con
`chk_*_no_self`. Orden DELETE del prompt correcto; precisiones: borrar `project` antes que
`project_recommendation`/`rule_evaluation`; conservar `rule`/`rule_version`. Carga: `skill` antes de
`incident_category`; `delivery_area`+`sla_policy` antes del 1er incident.

**D-9 (tenant) — APROBADA: UN SOLO TENANT CREDIX.**
`UPDATE tenant SET name='CREDIX' WHERE id='c5d2f057…'` (code=CORE, id, mode=internal, active — intactos).
El SAC (`0477…`) está referenciado sólo por filas suyas: escalation_rule(6), service_category(3),
workflow_definition(1), delivery_area(2), document_sequence(1), ledger(70) — todas caen en Fase 2 +
TRUNCATE. Tras ello, cero FK ⇒ `DELETE FROM tenant WHERE code='SAC'`. Resultado: **1 tenant `CREDIX`**.

**(b) Volumen enciende las ~70 rutas — Sí [HECHO].** incident(245) alimenta workspace/operaciones/
incidents/mi-dia/mis-casos/cola-equipo/portal/partner/analytics. team_member(44)+squad(7)+squad_member
activos → /mi-*, /squads, /workload, capacidad. project(12)+project_task → projects/evolucion/mis-iniciativas.
case_survey(70%)→CSAT. major_incident(3)→torre ops. knowledge_article(22, incl draft)→knowledge/revisión.
project_recommendation(18)→rail convertibles (ruta RC). notification(~180)→campana. RPCs (dashboard_counts,
analytics_overview, supervisor_metrics, evolution_home/decisions, converted_cases, incident_behavior_analysis)
devuelven distribución graficable sin fallar.

**(c) Enums y vistas cubiertos — Sí [HECHO].** incident_status(10), priority(4 con 8/22/45/25),
intake(3: 20/210/15), project_status(6), recommendation_status(5), change/MI/dispute/fraud/risk status.
7 navs de persona + FULL_NAV(2) + responsable_comercial reciben dato dirigido.

**(d) Usuarios ancla alimentan sus pantallas — Sí [HECHO].** Identidad de persona =
`team_member.user_id=accountId` (getMyMemberId). Andrés(operador)/Juan(squad_member)/Giselle(support_lead)/
Daniel(product_owner) llevan team_member; Tomás(partner_user) es reporter. Cuentas: operador→Andrés González,
squads→Juan Pacheco, usuario→Tomás Alvarado, evolucion→Daniel Blohm, operaciones→Giselle Arias;
`ignacio.perez@tiicr.com` INTOCABLE (login real). Matriz pantalla→tabla→mínimo documentada.

**(e) Flujo Mesa→Ops→Squad→Evolución punta a punta — Sí [HECHO]:**
incident(Tomás,accepted,Andrés) → incident_comment/case_work_log/escalation_event → problem_incident→problem
→ rule_evaluation(TRANSFORM_CREDIX_001 v1) → project_recommendation → project(created_from_*) →
project_incident_link (incident `in_evolution`, ancla viva) → project_task(Juan)/project_squad/risk/validation
→ change_request(WF-CHANGE-CAB, Daniel) → knowledge_article. ≥3 cadenas con IDs reales en Gate 5.

---

## 0.5 Dependencias resueltas por DATO (sin hardcode) — [DECISIÓN]
- Umbral de transformación leído de `rule_version` v1 (Fase 5), no quemado.
- **D-10 (APROBADA):** cuentas sintéticas (núcleo/pool/RC) = `user_account` con `auth_user_id=NULL`
  (dato/FK, no logins) → habilitan squad.po_user_id, business_unit.rc_user_id, product.owner_user_id, etc.
- Semilla determinista `setseed(0.42)` por script de Fase 4/5.

---

## 0.6 Autorizaciones del Gate 0 — TODAS APROBADAS (2026-07-15)
1. **D-9** — Un solo tenant: renombrar CORE→`CREDIX` (name) + eliminar SAC.
2. **Fase 2.3** — `TRUNCATE immutable_audit_event` + génesis auto.
3. **D-1** — numeración por prefijos vivos (`DP/FR/WF/SR`); document_sequence 12 doc_type reales, reset 0.
4. **D-2/D-3/D-4/D-5** — mapeos channel_type / squad_role / escalation action / service_category.
5. **D-10** — cuentas sintéticas con `auth_user_id=NULL`.
6. Corrección de nombres limitada a **"Andrey Siolano"→"Andrey Solano"**.

Estructura (tablas, columnas, tipos, enums, FK, triggers, funciones, RLS, grants) **100% intacta**; sólo DML.
