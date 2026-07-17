# sql/seed — Limpieza total controlada y repoblado integral (CredixNexus)

Scripts reproducibles de la operacion de limpieza + repoblado del tenant **CREDIX**
(ref Supabase `dffbysjrvvlwgzgakhaa`). Ejecutados como bloques atomicos (`do $$ ... $$`)
via Supabase MCP con el rol `postgres`. Ver dictamenes en `docs/seed/`.

## Orden de ejecucion
| # | Script | Contenido |
|---|--------|-----------|
| 02 | `02_limpieza.sql` | FASE 2 — DELETE transaccionales + maestros, TRUNCATE ledger, rename CORE→CREDIX + DELETE tenant SAC |
| 03a | `03a_catalogos_base.sql` | delivery_area, skill, sla/ola/escalation, macro, governance_item, document_sequence, case_type, service_category, business_unit, channel |
| 03b | `03b_maestros_dominio.sql` | incident_category, vendor, service, product, process |
| 03c | `03c_cuentas_roles.sql` | rename cuentas ancla + 27 cuentas nuevas + user_role |
| 03d | `03d_cmdb.sql` | configuration_item, ci_channel, process_system |
| 03e | `03e_talento.sql` | tribe, squad, team_member, squad_member |
| 03f | `03f_servicios_workflows.sql` | workflows(def/node/edge), service_item, business_unit.rc_user_id, product_channel |
| 04 | `04_personas_sinteticas.sql` | party, usuarios finales, operadores, perfiles squad, skills/eval/expertise, asset_assignment |
| 05a | `05a_ola_a_mesa.sql` | 245 incidentes + comentarios/worklogs/tareas/encuestas/escalamientos/adjuntos |
| 05b | `05b_ola_b_ops_grc.sql` | problemas, MI, disputas, fraude, riesgo, alertas, DX events |
| 05c | `05c_ola_c_solicitudes.sql` | 30 solicitudes de servicio + workflow instances/steps |
| 05d | `05d_ola_d_evolucion.sql` | rule_evaluation → recomendacion → proyecto → tareas/squads/riesgos/validaciones + change_request |
| 05e | `05e_ola_e_conocimiento.sql` | conocimiento, notificaciones, vistas, ci_relationship, service_dependency, agent_action |
| 06 | `06_verificacion_fixups.sql` | Juan≥35 tareas, incident_assignee, governance_link |

## Notas
- **Semilla determinista** `setseed(0.42)` en olas sinteticas; el resto usa `md5()`/`hashtext()`
  (deterministas) para reproducibilidad.
- Numeracion, SLA, area de entrega y **ledger** son por **trigger** (no se setean a mano salvo excepciones).
- `user_role` y `tenant` requieren toggle transitorio de trigger de auditoria (bug latente del ledger
  generico); documentado en `tasks/lessons.md`.
- La estructura del esquema queda **100% intacta**: sólo DML.
- Snapshot de rollback previo: `backup/pre_seed_20260715/` (83 CSV + manifest md5).
- Dictamenes: `docs/seed/DICTAMEN_PREVIO.md` y `docs/seed/VERIFICACION_FINAL.md`.
