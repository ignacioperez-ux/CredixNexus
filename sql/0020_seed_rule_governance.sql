-- ============================================================================
-- Credix Nexus — 0020 — Seed motor + gobernanza (idempotente)
-- Rol RC (Responsable Comercial), regla de transformacion por defecto y
-- gobernanza (politica/control/procedimiento) enlazada a la regla.
-- ============================================================================

-- Rol RC + permisos de decision de recomendaciones
insert into public.role (tenant_id, code, name, description, is_system)
values (null, 'responsable_comercial', 'Responsable Comercial (RC)', 'Decide y prioriza las mejoras que van a Evolucion (area de negocio)', true)
on conflict do nothing;

insert into public.permission (code, resource, action, description) values
  ('recommendation.read','recommendation','read','Ver recomendaciones'),
  ('recommendation.decide','recommendation','decide','Aprobar/rechazar/priorizar recomendaciones'),
  ('rule.simulate','rule','simulate','Simular reglas')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id from (values
  ('responsable_comercial','recommendation.read'),
  ('responsable_comercial','recommendation.decide'),
  ('business_owner','recommendation.decide'),
  ('product_owner','recommendation.read'),
  ('grc_officer','rule.approve')
) as m(rc,pc)
join public.role r on r.code=m.rc and r.tenant_id is null
join public.permission p on p.code=m.pc on conflict do nothing;

do $$
declare v_tenant uuid; v_rule uuid; v_rv uuid; v_pol uuid;
begin
  select id into v_tenant from public.tenant where code='CORE';
  if v_tenant is null then return; end if;

  -- Regla de transformacion (una sola por tenant en el seed)
  if not exists (select 1 from public.rule where tenant_id=v_tenant and code='TRANSFORM_CREDIX_001') then
    insert into public.rule (tenant_id, code, name, rule_type, status, description)
    values (v_tenant, 'TRANSFORM_CREDIX_001', 'Scoring de Transformacion Credix', 'transformation', 'active',
            'Evalua si un incidente debe elevarse a proyecto de Evolucion.')
    returning id into v_rule;

    insert into public.rule_version (tenant_id, rule_id, version_number, status, weights_json, thresholds_json, expression_json, effective_from, approved_at)
    values (v_tenant, v_rule, 1, 'published',
      jsonb_build_object(
        'financial_impact', 0.25, 'frequency_recurrence', 0.15, 'critical_service', 0.15,
        'partner_impact', 0.15, 'data_quality', 0.10, 'security_risk', 0.10,
        'manual_workaround', 0.05, 'strategic_alignment', 0.05),
      jsonb_build_object('operational', 39.99, 'problem_review', 69.99, 'project_review', 84.99, 'auto_project', 85.00),
      jsonb_build_object(
        'financial_impact', jsonb_build_object('max', 2000000),
        'frequency_recurrence', jsonb_build_object('windowDays', 30, 'max', 10),
        'partner_impact', jsonb_build_object('max', 5),
        'critical_service', jsonb_build_object('critical', 100, 'high', 70, 'medium', 40, 'low', 10),
        'strategic_alignment', jsonb_build_object('default', 50)),
      now(), now())
    returning id into v_rv;
  end if;

  -- Gobernanza: politica, control, procedimiento
  if not exists (select 1 from public.governance_item where tenant_id=v_tenant and code='POL_TRANSFORM') then
    insert into public.governance_item (tenant_id, item_type, code, name, description)
    values (v_tenant, 'policy', 'POL_TRANSFORM', 'Politica de Transformacion Operativa',
            'Marco para decidir cuando un incidente se eleva a proyecto de Evolucion.')
    returning id into v_pol;
    insert into public.governance_item (tenant_id, item_type, code, name, description) values
      (v_tenant, 'control', 'CTL_BUSINESS_DECISION', 'Control: decision de negocio (RC)',
       'La priorizacion a Evolucion la decide el Responsable Comercial del area de negocio.'),
      (v_tenant, 'procedure', 'PRC_EVOLUTION_INTAKE', 'Procedimiento de intake a Evolucion',
       'Pasos para llevar una mejora aprobada al squad de Evolucion manteniendo el tracking en la mesa.'),
      (v_tenant, 'norm', 'NRM_AUDIT_GRADE', 'Norma de trazabilidad audit-grade',
       'Toda decision del motor y del negocio queda registrada en el ledger inmutable.');

    -- Enlaza la regla a la politica que la gobierna
    if v_rule is not null and v_pol is not null then
      insert into public.governance_link (tenant_id, governance_item_id, entity_type, entity_id)
      values (v_tenant, v_pol, 'rule', v_rule) on conflict do nothing;
    end if;
  end if;
end $$;
