-- 0045_change_management.sql
-- Gestion de Cambios (ITIL 4 / F-Fin4). Un cambio puede nacer de un incidente o
-- de un problema (error conocido) y se gobierna por CAB. La mesa conserva el
-- tracking: el cambio enlaza bidireccionalmente su incidente/problema origen y,
-- opcionalmente, una instancia del motor de workflow (WF-CHANGE-CAB).
-- Multi-tenant + RLS + auditado. Numeracion CHG-.

create table if not exists public.change_request (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenant(id) on delete cascade,
  change_number         varchar(32) not null,
  title                 varchar(200) not null,
  description           text,
  change_type           varchar(12) not null default 'normal'
                          check (change_type in ('standard','normal','emergency')),
  risk_level            varchar(8) not null default 'medium'
                          check (risk_level in ('low','medium','high')),
  priority              priority_level,
  status                varchar(16) not null default 'draft'
                          check (status in ('draft','assessment','pending_cab','approved',
                                            'scheduled','implementing','review','closed','rejected','cancelled')),
  justification         text,
  implementation_plan   text,
  rollback_plan         text,
  affected_ci_id        uuid references public.configuration_item(id) on delete set null,
  affected_service_id   uuid references public.service(id) on delete set null,
  related_incident_id   uuid references public.incident(id) on delete set null,
  related_problem_id    uuid references public.problem(id) on delete set null,
  workflow_instance_id  uuid references public.workflow_instance(id) on delete set null,
  requested_by          uuid references public.user_account(id) on delete set null,
  assigned_to           uuid references public.user_account(id) on delete set null,
  planned_start         timestamptz,
  planned_end           timestamptz,
  actual_start          timestamptz,
  actual_end            timestamptz,
  cab_decision          varchar(10) check (cab_decision is null or cab_decision in ('approved','rejected')),
  cab_decision_at       timestamptz,
  cab_decision_by       uuid,
  cab_notes             text,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  created_by            uuid,
  updated_at            timestamptz not null default now(),
  updated_by            uuid,
  constraint change_number_unique unique (tenant_id, change_number),
  -- Ventanas: fin no anterior a inicio (§10.3, ambos sentidos)
  constraint change_planned_window check (planned_end is null or planned_start is null or planned_end >= planned_start),
  constraint change_actual_window  check (actual_end  is null or actual_start  is null or actual_end  >= actual_start)
);
create index if not exists idx_change_tenant_status on public.change_request (tenant_id, status);
create index if not exists idx_change_incident on public.change_request (related_incident_id);
create index if not exists idx_change_problem on public.change_request (related_problem_id);

-- Numeracion CHG-
create or replace function public.set_change_number()
returns trigger language plpgsql
set search_path = public as $$
begin
  if new.change_number is null or new.change_number = '' then
    new.change_number := public.next_document_number(new.tenant_id, 'change', 'CHG');
  end if;
  return new;
end $$;

drop trigger if exists trg_change_number on public.change_request;
create trigger trg_change_number before insert on public.change_request for each row execute function public.set_change_number();
drop trigger if exists trg_change_updated on public.change_request;
create trigger trg_change_updated before update on public.change_request for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_change on public.change_request;
create trigger trg_audit_change after insert or update or delete on public.change_request for each row execute function public.audit_row_change();

alter table public.change_request enable row level security;
drop policy if exists change_isolation on public.change_request;
create policy change_isolation on public.change_request using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

insert into public.permission (code, resource, action, description) values
  ('change.read',    'change', 'read',    'Ver solicitudes de cambio'),
  ('change.manage',  'change', 'manage',  'Crear y gestionar solicitudes de cambio'),
  ('change.approve', 'change', 'approve', 'Decision CAB: aprobar o rechazar cambios')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (
     (p.code = 'change.read'    and r.code in ('support_agent','support_lead','auditor','ai_agent','system_admin','tenant_admin','change_manager','product_owner'))
  or (p.code = 'change.manage'  and r.code in ('support_lead','change_manager','system_admin','tenant_admin'))
  or (p.code = 'change.approve' and r.code in ('change_manager','system_admin','tenant_admin'))
)
where p.code in ('change.read','change.manage','change.approve')
on conflict do nothing;
