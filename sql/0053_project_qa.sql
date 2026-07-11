-- 0053_project_qa.sql
-- F4: Compuerta de calidad de Evolucion. Antes de autorizar el pase a produccion se
-- corre una BATERIA DE PRUEBAS en ambiente de pruebas, se valida, y un responsable
-- AUTORIZA la produccion (evita pases a prod sin control). Reutiliza el motor de
-- workflow (definicion 'Evolucion de proyecto'). Multi-tenant + RLS + auditado.

-- Estado de calidad + autorizacion en el proyecto
alter table public.project
  add column if not exists qa_status varchar(12) not null default 'pending'
    check (qa_status in ('pending','in_testing','passed','failed')),
  add column if not exists prod_authorized_by uuid,
  add column if not exists prod_authorized_at timestamptz,
  add column if not exists validation_notes text;

-- Bateria de pruebas: cada corrida queda registrada como evidencia.
create table if not exists public.project_validation (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id) on delete cascade,
  project_id    uuid not null references public.project(id) on delete cascade,
  name          varchar(200) not null,
  test_type     varchar(16) not null default 'functional'
                  check (test_type in ('functional','regression','integration','uat','security','performance','smoke')),
  environment   varchar(12) not null default 'test'
                  check (environment in ('test','staging','preprod')),
  result        varchar(10) not null default 'pass'
                  check (result in ('pass','fail','blocked')),
  evidence_url  varchar(500),
  notes         text,
  run_by        uuid,
  run_at        timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  created_by    uuid
);
create index if not exists idx_project_validation_project on public.project_validation (project_id, run_at);

drop trigger if exists trg_audit_project_validation on public.project_validation;
create trigger trg_audit_project_validation after insert or update or delete on public.project_validation for each row execute function public.audit_row_change();

alter table public.project_validation enable row level security;
drop policy if exists project_validation_isolation on public.project_validation;
create policy project_validation_isolation on public.project_validation using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

insert into public.permission (code, resource, action, description) values
  ('project.validate', 'project', 'validate', 'Registrar pruebas y estado de calidad del proyecto'),
  ('project.deploy',   'project', 'deploy',   'Autorizar el pase a produccion (control de Evolucion)')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (
     (p.code = 'project.validate' and r.code in ('support_lead','change_manager','system_admin','tenant_admin'))
  or (p.code = 'project.deploy'   and r.code in ('change_manager','system_admin','tenant_admin'))
)
where p.code in ('project.validate','project.deploy')
on conflict do nothing;

-- Siembra de la definicion de workflow "Evolucion de proyecto" (reutiliza el motor).
do $$
declare v_tenant uuid; v_def uuid;
        n_start uuid; n_ana uuid; n_prio uuid; n_asig uuid; n_const uuid; n_test uuid; n_val uuid; n_auth uuid; n_close uuid; n_rej uuid;
begin
  for v_tenant in select id from public.tenant loop
    if exists (select 1 from public.workflow_definition where tenant_id=v_tenant and code='WF-EVOLUTION') then continue; end if;

    insert into public.workflow_definition (tenant_id, code, name, description, entity_type, status)
    values (v_tenant, 'WF-EVOLUTION', 'Evolucion de proyecto',
            'Analisis y viabilidad, priorizacion por ROI, asignacion a squad, construccion, bateria de pruebas, validacion y autorizacion a produccion.',
            'project', 'active')
    returning id into v_def;

    insert into public.workflow_node (tenant_id, definition_id, code, name, node_type, assignee_role, sort_order) values
      (v_tenant, v_def, 'START', 'Inicio', 'start', null, 0) returning id into n_start;
    insert into public.workflow_node (tenant_id, definition_id, code, name, node_type, assignee_role, sort_order) values
      (v_tenant, v_def, 'ANALISIS', 'Analisis y viabilidad', 'task', 'change_manager', 1) returning id into n_ana;
    insert into public.workflow_node (tenant_id, definition_id, code, name, node_type, assignee_role, sort_order) values
      (v_tenant, v_def, 'PRIORIZACION', 'Priorizacion (ROI/WSJF)', 'task', 'change_manager', 2) returning id into n_prio;
    insert into public.workflow_node (tenant_id, definition_id, code, name, node_type, assignee_role, sort_order) values
      (v_tenant, v_def, 'ASIGNACION', 'Asignacion a squad', 'task', 'change_manager', 3) returning id into n_asig;
    insert into public.workflow_node (tenant_id, definition_id, code, name, node_type, assignee_role, sort_order) values
      (v_tenant, v_def, 'CONSTRUCCION', 'Construccion', 'task', 'support_lead', 4) returning id into n_const;
    insert into public.workflow_node (tenant_id, definition_id, code, name, node_type, assignee_role, sort_order) values
      (v_tenant, v_def, 'PRUEBAS', 'Bateria de pruebas (ambiente de pruebas)', 'task', 'support_lead', 5) returning id into n_test;
    insert into public.workflow_node (tenant_id, definition_id, code, name, node_type, assignee_role, sort_order) values
      (v_tenant, v_def, 'VALIDACION', 'Validacion de calidad', 'approval', 'change_manager', 6) returning id into n_val;
    insert into public.workflow_node (tenant_id, definition_id, code, name, node_type, assignee_role, sort_order) values
      (v_tenant, v_def, 'AUTORIZACION', 'Autorizacion a produccion', 'approval', 'change_manager', 7) returning id into n_auth;
    insert into public.workflow_node (tenant_id, definition_id, code, name, node_type, sort_order) values
      (v_tenant, v_def, 'CIERRE', 'Cierre', 'end', 8) returning id into n_close;
    insert into public.workflow_node (tenant_id, definition_id, code, name, node_type, sort_order) values
      (v_tenant, v_def, 'RECHAZADO', 'No autorizado', 'end', 9) returning id into n_rej;

    insert into public.workflow_edge (tenant_id, definition_id, from_node_id, to_node_id, guard, label, sort_order) values
      (v_tenant, v_def, n_start, n_ana,  null, null, 0),
      (v_tenant, v_def, n_ana,   n_prio, null, null, 0),
      (v_tenant, v_def, n_prio,  n_asig, null, null, 0),
      (v_tenant, v_def, n_asig,  n_const,null, null, 0),
      (v_tenant, v_def, n_const, n_test, null, null, 0),
      (v_tenant, v_def, n_test,  n_val,  null, null, 0),
      (v_tenant, v_def, n_val,   n_auth, 'approved', 'Calidad OK', 0),
      (v_tenant, v_def, n_val,   n_const,'rejected', 'Reproceso',  1),
      (v_tenant, v_def, n_auth,  n_close,'approved', 'Autorizado', 0),
      (v_tenant, v_def, n_auth,  n_rej,  'rejected', 'No autorizado', 1);
  end loop;
end $$;
