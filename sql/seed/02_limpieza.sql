-- ============================================================================
-- 02_limpieza.sql  ·  FASE 2 — Limpieza total controlada (CredixNexus)
-- Reproducible. Idempotente en la practica (borra todo lo transaccional + maestros
-- a reemplazar; conserva INTOCABLES). ATOMICO: cualquier desvio de conteo => RAISE => ROLLBACK.
--
-- INTOCABLES (no se tocan): permission, role, role_permission, user_account, user_role,
--                           rule, rule_version, tenant (solo rename + delete SAC via D-9).
-- Ledger: TRUNCATE (append-only; unica via). Se reinicia a 0 => genesis lo bootstrapea Fase 3.
-- D-9: rename tenant CORE.name -> 'CREDIX'; DELETE tenant SAC (requiere trg_audit_tenant OFF
--      transitorio: postgres es dueno; se restaura al estado identico).
-- Ventana ejecucion: 2026-07-15. Snapshot previo: backup/pre_seed_20260715/.
-- ============================================================================
do $$
declare
  r record; v bigint; total bigint := 0; offenders text := '';
  target text[] := array[
    -- transaccionales + maestros a reemplazar (74 tablas)
    'workflow_step','workflow_edge','workflow_instance','workflow_node','workflow_definition',
    'service_request','service_item','service_dependency',
    'knowledge_feedback','knowledge_event','knowledge_article_version','knowledge_article',
    'project_incident_link','project_validation','project_risk','project_squad','project_task',
    'change_request','project','project_recommendation','rule_evaluation',
    'major_incident_update','major_incident','problem_incident','problem',
    'dispute_case','fraud_case','risk_event','escalation_event',
    'case_survey','case_work_log','case_task','case_attachment','incident_comment',
    'monitoring_alert','digital_experience_event','incident_assignee',
    'saved_view','agent_action','member_evaluation','notification','asset_assignment',
    'incident',
    'squad_member','member_skill','member_expertise','team_member','squad','tribe',
    'product_channel','ci_channel','ci_relationship','process_system','process',
    'configuration_item','product','service','service_category','vendor',
    'incident_category','case_type','skill',
    'escalation_rule','sla_policy','ola_policy','macro','governance_link','governance_item',
    'document_sequence','delivery_area','channel','business_unit','party_role','party'
  ];
begin
  -- ---- 2.1 + 2.2  DELETE en orden hijo -> padre (respeta FK) ----
  delete from workflow_step;
  delete from workflow_edge;
  delete from workflow_instance;
  delete from workflow_node;
  delete from workflow_definition;
  delete from service_request;
  delete from service_item;
  delete from service_dependency;
  delete from knowledge_feedback;
  delete from knowledge_event;
  delete from knowledge_article_version;
  delete from knowledge_article;
  delete from project_incident_link;
  delete from project_validation;
  delete from project_risk;
  delete from project_squad;
  delete from project_task;
  delete from change_request;
  delete from project;
  delete from project_recommendation;
  delete from rule_evaluation;
  delete from major_incident_update;
  delete from major_incident;
  delete from problem_incident;
  delete from problem;
  delete from dispute_case;
  delete from fraud_case;
  delete from risk_event;
  delete from escalation_event;
  delete from case_survey;
  delete from case_work_log;
  delete from case_task;
  delete from case_attachment;
  delete from incident_comment;
  delete from monitoring_alert;
  delete from digital_experience_event;
  delete from incident_assignee;
  delete from saved_view;
  delete from agent_action;
  delete from member_evaluation;
  delete from notification;
  delete from asset_assignment;
  delete from incident;
  delete from squad_member;
  delete from member_skill;
  delete from member_expertise;
  delete from team_member;
  delete from squad;
  delete from tribe;
  delete from product_channel;
  delete from ci_channel;
  delete from ci_relationship;
  delete from process_system;
  delete from process;
  delete from configuration_item;
  delete from product;
  delete from service;
  delete from service_category;
  delete from vendor;
  delete from incident_category;
  delete from case_type;
  delete from skill;
  delete from escalation_rule;
  delete from sla_policy;
  delete from ola_policy;
  delete from macro;
  delete from governance_link;
  delete from governance_item;
  delete from document_sequence;
  delete from delivery_area;
  delete from channel;
  delete from business_unit;
  delete from party_role;
  delete from party;

  -- ---- D-9 (a) rename CORE -> CREDIX (auditado; se truncara enseguida) ----
  update public.tenant set name = 'CREDIX' where code = 'CORE';

  -- ---- 2.3 ledger reset (append-only: TRUNCATE es la unica via) ----
  truncate table public.immutable_audit_event;

  -- ---- D-9 (b) DELETE tenant SAC (trigger de auditoria OFF transitorio) ----
  alter table public.tenant disable trigger trg_audit_tenant;
  delete from public.tenant where code = 'SAC';
  alter table public.tenant enable trigger trg_audit_tenant;

  -- ================= GUARDS (desvio => ROLLBACK + STOP) =================
  -- conteo real por tabla objetivo (todas deben quedar en 0)
  total := 0; offenders := '';
  for r in select unnest(target) as t loop
    execute format('select count(*) from public.%I', r.t) into v;
    if v > 0 then offenders := offenders || r.t || '(' || v || ') '; total := total + v; end if;
  end loop;
  if total > 0 then
    raise exception 'CLEANUP_ABORT: tablas objetivo no vacias -> %', offenders;
  end if;

  -- INTOCABLES intactos
  if (select count(*) from permission)      <> 65  then raise exception 'INTOCABLE permission cambio'; end if;
  if (select count(*) from role)            <> 15  then raise exception 'INTOCABLE role cambio'; end if;
  if (select count(*) from role_permission) <> 348 then raise exception 'INTOCABLE role_permission cambio'; end if;
  if (select count(*) from user_account)    <> 6   then raise exception 'INTOCABLE user_account cambio'; end if;
  if (select count(*) from user_role)       <> 7   then raise exception 'INTOCABLE user_role cambio'; end if;
  if (select count(*) from rule)            <> 1   then raise exception 'INTOCABLE rule cambio'; end if;
  if (select count(*) from rule_version)    <> 1   then raise exception 'INTOCABLE rule_version cambio'; end if;

  -- tenant final = 1 (CREDIX); ledger = 0
  if (select count(*) from tenant) <> 1 then raise exception 'tenant count != 1'; end if;
  if not exists (select 1 from tenant where code='CORE' and name='CREDIX') then raise exception 'rename CORE->CREDIX fallo'; end if;
  if (select count(*) from immutable_audit_event) <> 0 then raise exception 'ledger no quedo en 0'; end if;

  raise notice 'FASE 2 OK: 74 tablas objetivo en 0; ledger 0; tenant unico CREDIX; INTOCABLES intactos.';
end $$;
