-- 0042_problem_management.sql
-- ITIL 4 Problem Management: un problema agrupa N incidentes que comparten causa raiz.
-- La mesa de ayuda nunca pierde el control (centro de la herramienta): el problema es
-- ancla de investigacion y el hilo con cada incidente sobrevive via problem_incident.
-- Multi-tenant + RLS + auditoria (ledger inmutable) + numeracion PRB-.

-- ============================================================================
-- Tabla problem
-- ============================================================================
create table if not exists public.problem (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenant(id) on delete cascade,
  problem_number      varchar(32) not null,
  title               varchar(200) not null,
  description         text,
  status              varchar(20) not null default 'new'
                        check (status in ('new','investigating','known_error','resolved','closed')),
  priority            varchar(12) not null default 'medium'
                        check (priority in ('low','medium','high','critical')),
  category            varchar(80),
  root_cause_summary  text,
  workaround          text,
  known_error         boolean not null default false,
  resolution_summary  text,
  owner_user_id       uuid references public.user_account(id) on delete set null,
  affected_ci_id      uuid references public.configuration_item(id) on delete set null,
  affected_service_id uuid references public.service(id) on delete set null,
  opened_at           timestamptz not null default now(),
  resolved_at         timestamptz,
  closed_at           timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  created_by          uuid,
  updated_at          timestamptz not null default now(),
  updated_by          uuid,
  constraint problem_number_unique unique (tenant_id, problem_number),
  -- Fechas: cierre/resolucion no anteriores a apertura (§10.3, ambos sentidos cubiertos)
  constraint problem_resolved_after_open check (resolved_at is null or resolved_at >= opened_at),
  constraint problem_closed_after_open  check (closed_at   is null or closed_at   >= opened_at),
  -- known_error implica que ya se investigo la causa raiz
  constraint problem_known_error_needs_rca check (not known_error or root_cause_summary is not null)
);

create index if not exists idx_problem_tenant_status on public.problem (tenant_id, status);
create index if not exists idx_problem_owner on public.problem (owner_user_id);

-- ============================================================================
-- Tabla puente problem_incident (N:N) — vinculo problema <-> incidente
-- ============================================================================
create table if not exists public.problem_incident (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  problem_id   uuid not null references public.problem(id) on delete cascade,
  incident_id  uuid not null references public.incident(id) on delete cascade,
  note         text,
  linked_by    uuid,
  linked_at    timestamptz not null default now(),
  constraint problem_incident_unique unique (problem_id, incident_id)
);

create index if not exists idx_problem_incident_problem on public.problem_incident (problem_id);
create index if not exists idx_problem_incident_incident on public.problem_incident (incident_id);

-- ============================================================================
-- Numeracion PRB-
-- ============================================================================
create or replace function public.set_problem_number()
returns trigger language plpgsql
set search_path = public as $$
begin
  if new.problem_number is null or new.problem_number = '' then
    new.problem_number := public.next_document_number(new.tenant_id, 'problem', 'PRB');
  end if;
  return new;
end $$;

-- ============================================================================
-- Triggers (numeracion, updated_at, auditoria)
-- ============================================================================
drop trigger if exists trg_problem_number on public.problem;
create trigger trg_problem_number before insert on public.problem
  for each row execute function public.set_problem_number();

drop trigger if exists trg_problem_updated on public.problem;
create trigger trg_problem_updated before update on public.problem
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_problem on public.problem;
create trigger trg_audit_problem after insert or update or delete on public.problem
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_problem_incident on public.problem_incident;
create trigger trg_audit_problem_incident after insert or update or delete on public.problem_incident
  for each row execute function public.audit_row_change();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.problem enable row level security;
alter table public.problem_incident enable row level security;

drop policy if exists problem_isolation on public.problem;
create policy problem_isolation on public.problem
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists problem_incident_isolation on public.problem_incident;
create policy problem_incident_isolation on public.problem_incident
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- ============================================================================
-- Permisos RBAC
-- ============================================================================
insert into public.permission (code, resource, action, description) values
  ('problem.read',   'problem', 'read',   'Ver problemas y errores conocidos'),
  ('problem.manage', 'problem', 'manage', 'Gestionar problemas, causa raiz y vinculos')
on conflict (code) do nothing;

-- read: operacion + gobierno + auditoria; manage: lider de soporte (problem manager) + admin
insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (
     (p.code = 'problem.read'   and r.code in ('support_agent','support_lead','auditor','ai_agent','system_admin','tenant_admin'))
  or (p.code = 'problem.manage' and r.code in ('support_lead','system_admin'))
)
where p.code in ('problem.read','problem.manage')
on conflict do nothing;
