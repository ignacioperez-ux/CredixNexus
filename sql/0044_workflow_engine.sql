-- 0044_workflow_engine.sql
-- Motor de workflow no-code (F-Fin3, corte 2). Orquesta casos (incident/change/
-- request/generic) por un grafo dirigido de nodos. La mesa mantiene el tracking:
-- una instancia puede colgar de un incidente y su hilo sobrevive (client-centric).
-- Multi-tenant + RLS + auditado. Motor atomico en PL/pgSQL (audit-grade §11).

-- ============================================================================
-- Definicion (proceso versionado)
-- ============================================================================
create table if not exists public.workflow_definition (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  code         varchar(40) not null,
  name         varchar(200) not null,
  description  text,
  entity_type  varchar(20) not null default 'generic'
                 check (entity_type in ('incident','problem','change','request','generic')),
  status       record_status not null default 'draft',
  version_no   integer not null default 1,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  constraint workflow_definition_code_unique unique (tenant_id, code)
);
create index if not exists idx_wf_def_tenant on public.workflow_definition (tenant_id, status);

-- ============================================================================
-- Nodo
-- ============================================================================
create table if not exists public.workflow_node (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant(id) on delete cascade,
  definition_id  uuid not null references public.workflow_definition(id) on delete cascade,
  code           varchar(40) not null,
  name           varchar(200) not null,
  node_type      varchar(16) not null check (node_type in ('start','task','approval','automated','end')),
  assignee_role  varchar(40),
  assignee_team  varchar(100),
  sla_minutes    integer check (sla_minutes is null or sla_minutes > 0),
  sort_order     integer not null default 0,
  config         jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  constraint workflow_node_code_unique unique (definition_id, code)
);
create index if not exists idx_wf_node_def on public.workflow_node (definition_id);

-- ============================================================================
-- Arista (con guarda opcional que enruta segun el resultado del paso)
-- ============================================================================
create table if not exists public.workflow_edge (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant(id) on delete cascade,
  definition_id  uuid not null references public.workflow_definition(id) on delete cascade,
  from_node_id   uuid not null references public.workflow_node(id) on delete cascade,
  to_node_id     uuid not null references public.workflow_node(id) on delete cascade,
  guard          varchar(40),                 -- null = camino por defecto
  label          varchar(120),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  constraint workflow_edge_no_self check (from_node_id <> to_node_id),
  constraint workflow_edge_unique unique (from_node_id, to_node_id, guard)
);
create index if not exists idx_wf_edge_from on public.workflow_edge (from_node_id);
create index if not exists idx_wf_edge_def on public.workflow_edge (definition_id);

-- ============================================================================
-- Instancia (ejecucion)
-- ============================================================================
create table if not exists public.workflow_instance (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant(id) on delete cascade,
  instance_number  varchar(32) not null,
  definition_id    uuid not null references public.workflow_definition(id) on delete restrict,
  entity_type      varchar(20) not null default 'generic',
  entity_id        uuid,
  title            varchar(200) not null,
  status           varchar(16) not null default 'running' check (status in ('running','completed','cancelled')),
  started_by       uuid,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  constraint workflow_instance_number_unique unique (tenant_id, instance_number),
  constraint workflow_instance_completed_after check (completed_at is null or completed_at >= started_at)
);
create index if not exists idx_wf_inst_tenant on public.workflow_instance (tenant_id, status);
create index if not exists idx_wf_inst_entity on public.workflow_instance (entity_type, entity_id);

-- ============================================================================
-- Paso (estado de un nodo en una instancia)
-- ============================================================================
create table if not exists public.workflow_step (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenant(id) on delete cascade,
  instance_id       uuid not null references public.workflow_instance(id) on delete cascade,
  node_id           uuid not null references public.workflow_node(id) on delete restrict,
  status            varchar(12) not null default 'active' check (status in ('active','done','rejected','skipped')),
  outcome           varchar(40),
  assignee_user_id  uuid,
  note              text,
  activated_at      timestamptz not null default now(),
  completed_at      timestamptz,
  completed_by      uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  constraint workflow_step_once unique (instance_id, node_id)
);
create index if not exists idx_wf_step_instance on public.workflow_step (instance_id);
create index if not exists idx_wf_step_active on public.workflow_step (instance_id, status);

-- ============================================================================
-- Numeracion WF-
-- ============================================================================
create or replace function public.set_workflow_instance_number()
returns trigger language plpgsql
set search_path = public as $$
begin
  if new.instance_number is null or new.instance_number = '' then
    new.instance_number := public.next_document_number(new.tenant_id, 'workflow', 'WF');
  end if;
  return new;
end $$;

-- ============================================================================
-- Triggers: numeracion + updated_at + auditoria
-- ============================================================================
drop trigger if exists trg_wf_inst_number on public.workflow_instance;
create trigger trg_wf_inst_number before insert on public.workflow_instance for each row execute function public.set_workflow_instance_number();

drop trigger if exists trg_wf_def_updated on public.workflow_definition;
create trigger trg_wf_def_updated before update on public.workflow_definition for each row execute function public.set_updated_at();
drop trigger if exists trg_wf_node_updated on public.workflow_node;
create trigger trg_wf_node_updated before update on public.workflow_node for each row execute function public.set_updated_at();
drop trigger if exists trg_wf_inst_updated on public.workflow_instance;
create trigger trg_wf_inst_updated before update on public.workflow_instance for each row execute function public.set_updated_at();
drop trigger if exists trg_wf_step_updated on public.workflow_step;
create trigger trg_wf_step_updated before update on public.workflow_step for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_wf_def on public.workflow_definition;
create trigger trg_audit_wf_def after insert or update or delete on public.workflow_definition for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_wf_node on public.workflow_node;
create trigger trg_audit_wf_node after insert or update or delete on public.workflow_node for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_wf_edge on public.workflow_edge;
create trigger trg_audit_wf_edge after insert or update or delete on public.workflow_edge for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_wf_inst on public.workflow_instance;
create trigger trg_audit_wf_inst after insert or update or delete on public.workflow_instance for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_wf_step on public.workflow_step;
create trigger trg_audit_wf_step after insert or update or delete on public.workflow_step for each row execute function public.audit_row_change();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.workflow_definition enable row level security;
alter table public.workflow_node enable row level security;
alter table public.workflow_edge enable row level security;
alter table public.workflow_instance enable row level security;
alter table public.workflow_step enable row level security;

drop policy if exists wf_def_isolation on public.workflow_definition;
create policy wf_def_isolation on public.workflow_definition using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
drop policy if exists wf_node_isolation on public.workflow_node;
create policy wf_node_isolation on public.workflow_node using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
drop policy if exists wf_edge_isolation on public.workflow_edge;
create policy wf_edge_isolation on public.workflow_edge using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
drop policy if exists wf_inst_isolation on public.workflow_instance;
create policy wf_inst_isolation on public.workflow_instance using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
drop policy if exists wf_step_isolation on public.workflow_step;
create policy wf_step_isolation on public.workflow_step using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- ============================================================================
-- Motor: activar sucesores de un nodo segun la guarda que casa el resultado.
-- Los nodos 'end' se registran como paso 'done' (marcan fin de rama).
-- ============================================================================
create or replace function public._wf_activate_successors(p_instance uuid, p_from_node uuid, p_outcome text, p_actor uuid)
returns void language plpgsql
set search_path = public as $$
declare v_tenant uuid; e record; v_type text;
begin
  select tenant_id into v_tenant from public.workflow_instance where id = p_instance;
  for e in
    select ed.to_node_id, n.node_type
    from public.workflow_edge ed
    join public.workflow_node n on n.id = ed.to_node_id
    where ed.from_node_id = p_from_node
      and (ed.guard is null or ed.guard = p_outcome)
    order by ed.sort_order
  loop
    if e.node_type = 'end' then
      insert into public.workflow_step (tenant_id, instance_id, node_id, status, outcome, completed_at, completed_by)
      values (v_tenant, p_instance, e.to_node_id, 'done', 'end', now(), p_actor)
      on conflict (instance_id, node_id) do nothing;
    else
      insert into public.workflow_step (tenant_id, instance_id, node_id, status)
      values (v_tenant, p_instance, e.to_node_id, 'active')
      on conflict (instance_id, node_id) do nothing;
    end if;
  end loop;
end $$;

-- Propaga automaticamente nodos start/automated (no requieren accion humana).
create or replace function public._wf_propagate(p_instance uuid, p_actor uuid)
returns void language plpgsql
set search_path = public as $$
declare v_step record; v_guard int := 0;
begin
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 200; -- backstop anti-bucle
    select s.id, s.node_id into v_step
    from public.workflow_step s
    join public.workflow_node n on n.id = s.node_id
    where s.instance_id = p_instance and s.status = 'active' and n.node_type in ('start','automated')
    limit 1;
    exit when not found;

    update public.workflow_step set status='done', outcome='auto', completed_at=now(), completed_by=p_actor
    where id = v_step.id;
    perform public._wf_activate_successors(p_instance, v_step.node_id, 'auto', p_actor);
  end loop;
end $$;

create or replace function public._wf_check_completion(p_instance uuid)
returns void language plpgsql
set search_path = public as $$
begin
  if not exists (select 1 from public.workflow_step where instance_id = p_instance and status = 'active') then
    update public.workflow_instance
      set status = 'completed', completed_at = coalesce(completed_at, now())
      where id = p_instance and status = 'running';
  end if;
end $$;

-- Inicia una instancia y avanza los nodos automaticos hasta el primer paso humano.
create or replace function public.start_workflow(p_definition_id uuid, p_entity_type text, p_entity_id uuid, p_title text)
returns uuid language plpgsql
set search_path = public as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_actor  uuid := auth.uid();
  v_inst   uuid;
  v_start  uuid;
  v_starts int;
begin
  if v_tenant is null then raise exception 'no tenant context'; end if;
  if not exists (select 1 from public.workflow_definition where id = p_definition_id and tenant_id = v_tenant and status = 'active') then
    raise exception 'definition not active';
  end if;
  select count(*) into v_starts from public.workflow_node where definition_id = p_definition_id and node_type = 'start';
  if v_starts <> 1 then raise exception 'definition must have exactly one start node'; end if;
  select id into v_start from public.workflow_node where definition_id = p_definition_id and node_type = 'start';

  insert into public.workflow_instance (tenant_id, definition_id, entity_type, entity_id, title, started_by, created_by)
  values (v_tenant, p_definition_id, coalesce(p_entity_type,'generic'), p_entity_id, p_title, v_actor, v_actor)
  returning id into v_inst;

  insert into public.workflow_step (tenant_id, instance_id, node_id, status)
  values (v_tenant, v_inst, v_start, 'active');

  perform public._wf_propagate(v_inst, v_actor);
  perform public._wf_check_completion(v_inst);
  return v_inst;
end $$;

-- Avanza un paso activo con un resultado y enruta al/los siguiente(s) nodo(s).
create or replace function public.advance_workflow_step(p_step_id uuid, p_outcome text, p_note text)
returns void language plpgsql
set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_step  record;
begin
  select s.id, s.instance_id, s.node_id, s.status, i.status as inst_status
  into v_step
  from public.workflow_step s
  join public.workflow_instance i on i.id = s.instance_id
  where s.id = p_step_id
  for update of s;

  if not found then raise exception 'step not found'; end if;
  if v_step.status <> 'active' then raise exception 'step not active'; end if;
  if v_step.inst_status <> 'running' then raise exception 'instance not running'; end if;

  update public.workflow_step
    set status = case when p_outcome = 'rejected' then 'rejected' else 'done' end,
        outcome = coalesce(p_outcome, 'done'),
        note = p_note,
        completed_at = now(),
        completed_by = v_actor
    where id = p_step_id;

  perform public._wf_activate_successors(v_step.instance_id, v_step.node_id, coalesce(p_outcome,'done'), v_actor);
  perform public._wf_propagate(v_step.instance_id, v_actor);
  perform public._wf_check_completion(v_step.instance_id);
end $$;

-- ============================================================================
-- Permisos RBAC
-- ============================================================================
insert into public.permission (code, resource, action, description) values
  ('workflow.read',   'workflow', 'read',   'Ver definiciones e instancias de workflow'),
  ('workflow.run',    'workflow', 'run',    'Iniciar y avanzar instancias de workflow'),
  ('workflow.manage', 'workflow', 'manage', 'Disenar y publicar definiciones de workflow')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (
     (p.code = 'workflow.read'   and r.code in ('support_agent','support_lead','auditor','ai_agent','system_admin','tenant_admin','change_manager','product_owner'))
  or (p.code = 'workflow.run'    and r.code in ('support_agent','support_lead','system_admin','tenant_admin','change_manager'))
  or (p.code = 'workflow.manage' and r.code in ('support_lead','system_admin','tenant_admin','change_manager'))
)
where p.code in ('workflow.read','workflow.run','workflow.manage')
on conflict do nothing;
