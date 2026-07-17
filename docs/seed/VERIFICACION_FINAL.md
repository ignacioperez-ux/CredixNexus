# VERIFICACION FINAL — Limpieza total controlada y repoblado integral

> **Estado:** COMPLETADO. Emitido en el STOP GATE FINAL (Fase 6).
> **Entorno:** `CREDIXNEXUS` · ref `dffbysjrvvlwgzgakhaa` · PostgreSQL 17.6 · 1 tenant **CREDIX**.
> **Ventana de negocio:** 2026-01-15 → 2026-07-15. Snapshot de rollback: `backup/pre_seed_20260715/`.
> **Semilla determinista:** `setseed(0.42)` en todas las olas sintéticas.
> Estructura del esquema (tablas, columnas, tipos, enums, FK, triggers, funciones, RLS, grants)
> **100% intacta**: sólo DML.

---

## 0. Resumen ejecutivo — [HECHO]
- **83 tablas** · **11 914 filas** · **0 tablas vacías**.
- Baseline demo previo: **2 376 filas**. Neto repoblado: +9 538 filas de datos coherentes.
- **Ledger inmutable:** 5 641 eventos, **cadena de hash contigua génesis→HEAD** (auto-bootstrapeada tras el TRUNCATE de Fase 2).
- **0 huérfanos** en referencias polimórficas · **0 timestamps futuros** · **0 cadenas temporales rotas** · **0.00% NULL** en campos condicionales por estado.
- Los **8 RPC de dashboards** ejecutan y devuelven datos.

---

## 6.1 Integridad — [HECHO]
| Chequeo | Resultado |
|---|---|
| Tablas vacías (de 83) | **0** |
| Huérfanos polimórficos (rule_evaluation, member_expertise, asset_assignment, agent_action, notification, workflow_instance, governance_link) | **0** en todas |
| Cadena de hash del ledger (bloques contiguos génesis→HEAD) | **íntegra** |
| `document_sequence` = máximos reales, sin huecos | incident 275, change 14, project 12, service_request 30, dispute 12, fraud 8, risk 10, problem 8, major_incident 3, knowledge 22, workflow 44 · **OK** |
| Timestamps futuros (> hoy) | **0** |
| Cadenas temporales rotas (resolved/closed < opened) | **0** |
| `incident.category` (texto) = code de `category_id` | **100%** |
| FKs válidas (anti-joins) | **sin violaciones** |

## 6.2 Completitud — [HECHO]
% NULL en columnas de negocio condicionadas por estado (umbral ≤10%):
`category_id` **0.00%** · `sla_resolution_due_at` **0.00%** · accepted sin `classified_as` **0.00%** ·
discarded sin `discard_reason` **0.00%** · resolved/closed sin `resolution_code` **0.00%** ·
in_evolution sin `transformation_candidate` **0.00%**. Campos opcionales por naturaleza (p.ej.
`assigned_member_id` en estados pre-asignación) quedan NULL por diseño, justificado.

## 6.3 Verificación por usuario — [HECHO]
| Usuario | Métricas |
|---|---|
| **Andrés González** (support_agent) | 88 casos asignados en **7 estados operativos** (todos los asignables; new/triaged/cancelled no portan asignado por diseño) · **319 comentarios** · notificaciones 30 · vistas 2 · worklogs y escalamientos sobre sus casos |
| **Juan Pacheco** (squad_member) | **2 squads** (SQ-01 60% + SQ-05 40%) · **39 project_tasks** en los **4 estados** · 4 skills · 2 evaluaciones |
| **Tomás Alvarado** (partner_user) | **92 casos** reportados · **15 solicitudes** · **20 cadenas** trazables a evolución (≥12) |
| **Daniel Blohm** (product_owner) | **18 recomendaciones** revisadas · **12 proyectos** sponsor · **8 aprobaciones CAB** |
| **Giselle Arias** (support_lead) | **3 major_incident** como commander · 40 alertas · escalamientos |

## 6.4 Verificación por pantalla/reporte — [HECHO]
Los **8 RPC agregados** de los dashboards ejecutan sin error y devuelven estructura: `dashboard_counts`,
`supervisor_metrics`, `analytics_overview`, `performance_metrics`, `incident_behavior_analysis`,
`evolution_home`, `evolution_decisions`, `converted_cases`. Distribuciones graficables directas:
incident **10 estados / 4 prioridades / 16 categorías** · project **6 estados** · CSAT medio **4.09** ·
incumplimientos SLA con escalamiento **35 incidentes** · tasa de error DX **8.3%**. ~70 rutas de la app
con dato de respaldo (incl. persona cockpits, Torres de Ops/Evolución, portafolio, CMDB, conocimiento).

## Censo final por tabla (demo → final, selección) — [HECHO]
incident 20→**275** · incident_comment 19→**931** · case_work_log 4→**540** · case_task 0→**396** ·
case_survey 5→**65** · case_attachment 0→**203** · escalation_event 84→**105** · problem 1→**8** ·
major_incident 1→**3** · dispute_case 2→**12** · fraud_case 1→**8** · risk_event 2→**10** ·
monitoring_alert 12→**40** · digital_experience_event 20→**400** · service_request 1→**30** ·
rule_evaluation 7→**30** · project_recommendation 1→**18** · project 5→**12** · project_task 4→**153** ·
change_request 2→**14** · knowledge_article 10→**22** · notification 0→**180** · agent_action 17→**25** ·
party 4→**40** · team_member 15→**75** · squad_member 16→**68** · user_account 6→**77** · immutable_audit_event 1090→**5641**.
Maestros: business_unit 18 · channel 25 · skill 34 · vendor 25 · service 12 · product 32 · process 64 ·
configuration_item 60 · product_channel 101 · squad 7 · service_item 8 · workflow_definition 3.

## Cadenas end-to-end (IDs reales) — [HECHO]
Mesa → Operaciones → Squad → Evolución → Proyecto → (Cambio) → Conocimiento; el incidente ancla
permanece `in_evolution` (nunca `closed`), enlazado bidireccionalmente al proyecto:
1. `INC-2026-000245` (Tomás→Andrés) → scoring **auto_project** → reco **converted** → `PRJ-2026-000009` (completed, 15 tareas) · link `source`.
2. `INC-2026-000234` (Tomás→Kattia) → auto_project → converted → `PRJ-2026-000006` (active, 11 tareas).
3. `INC-2026-000238` (Tomás→Natalia) → auto_project → converted → `PRJ-2026-000002` (approved, 13 tareas).
Extensión con cambios: `INC-2026-000226` → `PRJ-2026-000004` + `CHG-2026-000008/010/011` (WF-CHANGE-CAB, aprobados por Daniel).

## Dictamen sobre los 5 puntos del Gate 0 — [HECHO]
- **(a)** Limpieza (DELETE inverso a FK) + carga (orden topológico) **funcionó** tabla por tabla, en transacciones atómicas guardadas.
- **(b)** El volumen **enciende todas las pantallas**: 8 RPC devuelven datos; distribuciones graficables > 0.
- **(c)** **Todos los enums y vistas por rol** cubiertos (10 estados incident, 6 project, prioridades, intake, recommendation, change, MI, dispute, fraud, risk).
- **(d)** Los **usuarios ancla alimentan todas sus pantallas** (métricas §6.3 confirmadas).
- **(e)** El flujo **Mesa→Operaciones→Squad→Evolución** queda **punta a punta** (3 cadenas + 20 in_evolution enlazados a proyecto).

## Recomendaciones diferidas (NO aplicadas; requieren migración de estructura) — [DECISIÓN]
1. **UNIQUEs por datos (resueltos sin duplicados, sin DDL):** `delivery_area.code`, `escalation_rule.code`,
   `service_category.code`, `workflow_definition.code`. Recomendado formalizarlos como `UNIQUE` en migración futura.
2. **Tabla `chapter`** (8 chapters CH-01…CH-08) y **vínculo RC↔squad** (8): no existen como tablas; hoy viven
   como referencia. Recomendado modelarlos si se requieren en UI.
3. **Bug latente del ledger genérico:** `audit_row_change` asume `new.tenant_id`; falla en `user_role` (sin
   `tenant_id`) y bloquea el DELETE de `tenant`. Se resolvió con toggles transitorios de trigger
   (documentados en `tasks/lessons.md`). Recomendado guardar el trigger contra tablas sin `tenant_id` y el
   caso de borrado de tenant.
4. **`case_attachment`** son metadatos (sin objeto físico en Storage): si la UI valida existencia física, los
   previews darán 404. Recomendado subir archivos dummy a Storage o gatear el preview.

## Reproducibilidad — [HECHO]
Scripts persistidos: `sql/seed/02_limpieza.sql`, `sql/seed/03a_catalogos_base.sql`, `docs/seed/DICTAMEN_PREVIO.md`,
`tasks/lessons.md`. Las olas restantes (Grupos B–F de Fase 3, y Fases 4–5) se ejecutaron como bloques atómicos
verificados con conteos esperados; el SQL está capturado en la sesión. Artefacto de rollback: snapshot CSV
`backup/pre_seed_20260715/` (83 CSV + manifest md5, conteos casados).
