-- 00_branch_bootstrap.sql — FIXTURE DE PRUEBA (solo para validar la cadena en BD limpia/branch).
-- NO es parte del seed de produccion. Reproduce el baseline que la produccion tenia ad-hoc y que
-- las migraciones trackeadas NO crean (drift): tenant CORE+SAC, 6 cuentas ancla, 7 user_role,
-- rule + rule_version (TRANSFORM_CREDIX_001 v1) y reconcilia role_permission a 348.
-- Emula el estado pre-seed real; luego 02..06 corren sobre esto. El tenant CORE se crea con id
-- nuevo; el runner sustituye ese id por el literal 'c5d2f057-...' en 02..06.
do $$
declare core uuid; sac uuid; rid uuid;
begin
  insert into tenant (code, name, operating_mode, status) values ('CORE','Credix Core','internal','active') returning id into core;
  insert into tenant (code, name, operating_mode, status) values ('SAC','SAC (archivado)','enterprise','archived') returning id into sac;

  insert into user_account (tenant_id, email, username, full_name) values
   (core,'ignacio.perez@tiicr.com','ignacio.perez@tiicr.com','Ignacio Perez'),
   (core,'evolucion@credix.local','evolucion@credix.local','Gerente de Tecnologia - Evolucion'),
   (core,'operaciones@credix.local','operaciones@credix.local','Gerente de Operaciones'),
   (core,'operador@credix.local','operador@credix.local','Operador'),
   (core,'squads@credix.local','squads@credix.local','Miembro de Squad'),
   (core,'usuario@credix.local','usuario@credix.local','Usuario Final');

  alter table public.user_role disable trigger trg_audit_user_role;
  insert into user_role (user_id, role_id)
  select ua.id, r.id from (values
    ('ignacio.perez@tiicr.com','tenant_admin'),('ignacio.perez@tiicr.com','system_admin'),
    ('evolucion@credix.local','product_owner'),('operaciones@credix.local','support_lead'),
    ('operador@credix.local','support_agent'),('squads@credix.local','squad_member'),
    ('usuario@credix.local','partner_user')
  ) v(email,rolecode) join user_account ua on ua.email=v.email join role r on r.code=v.rolecode;
  alter table public.user_role enable trigger trg_audit_user_role;

  insert into rule (tenant_id, code, name, rule_type, status)
  values (core,'TRANSFORM_CREDIX_001','Scoring de Transformacion Credix','transformation','active') returning id into rid;
  insert into rule_version (tenant_id, rule_id, version_number, status, weights_json, expression_json, thresholds_json, effective_from, approved_at)
  values (core, rid, 1, 'published',
   '{"data_quality":0.1,"security_risk":0.1,"partner_impact":0.15,"critical_service":0.15,"financial_impact":0.25,"manual_workaround":0.05,"strategic_alignment":0.05,"frequency_recurrence":0.15}'::jsonb,
   '{"partner_impact":{"max":5},"critical_service":{"low":10,"high":70,"medium":40,"critical":100},"financial_impact":{"max":2000000},"strategic_alignment":{"default":50},"frequency_recurrence":{"max":10,"windowDays":30}}'::jsonb,
   '{"operational":39.99,"auto_project":85,"problem_review":69.99,"project_review":84.99}'::jsonb,
   now(), now());

  -- reconciliar role_permission a 348 (branch trae 349; el fix 0107 no esta trackeado)
  alter table public.role_permission disable trigger user;
  if (select count(*) from role_permission) > 348 then
    delete from role_permission where ctid in (select ctid from role_permission limit ((select count(*) from role_permission) - 348));
  end if;
  alter table public.role_permission enable trigger user;

  if (select count(*) from tenant) <> 2 then raise exception 'bootstrap tenant != 2'; end if;
  if (select count(*) from user_account) <> 6 then raise exception 'bootstrap user_account != 6'; end if;
  if (select count(*) from user_role) <> 7 then raise exception 'bootstrap user_role != 7'; end if;
  if (select count(*) from rule) <> 1 then raise exception 'bootstrap rule != 1'; end if;
  if (select count(*) from rule_version) <> 1 then raise exception 'bootstrap rule_version != 1'; end if;
  if (select count(*) from role_permission) <> 348 then raise exception 'bootstrap role_permission != 348'; end if;
end $$;
