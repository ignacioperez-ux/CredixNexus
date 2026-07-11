-- 0050_squad_member.sql
-- F1: Roster de squad. Relaciona team_member <-> squad con su FUNCION en el squad
-- (lead, product_owner, tech_lead, developer, qa, analyst, scrum_master) y su
-- asignacion (%). Permite ver "quien es parte del squad" y medir composicion/capacidad.
-- Multi-tenant + RLS + auditado + soft-delete.

create table if not exists public.squad_member (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant(id) on delete cascade,
  squad_id       uuid not null references public.squad(id) on delete cascade,
  member_id      uuid not null references public.team_member(id) on delete cascade,
  squad_role     varchar(20) not null
                   check (squad_role in ('lead','product_owner','tech_lead','developer','qa','analyst','scrum_master')),
  allocation_pct integer not null default 100 check (allocation_pct between 0 and 100),
  valid_from     date not null default current_date,
  valid_to       date,
  status         record_status not null default 'active',
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  constraint squad_member_unique unique (squad_id, member_id),
  constraint squad_member_valid_window check (valid_to is null or valid_to >= valid_from)
);
create index if not exists idx_squad_member_squad on public.squad_member (squad_id);
create index if not exists idx_squad_member_member on public.squad_member (member_id);

drop trigger if exists trg_squad_member_updated on public.squad_member;
create trigger trg_squad_member_updated before update on public.squad_member for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_squad_member on public.squad_member;
create trigger trg_audit_squad_member after insert or update or delete on public.squad_member for each row execute function public.audit_row_change();

alter table public.squad_member enable row level security;
drop policy if exists squad_member_isolation on public.squad_member;
create policy squad_member_isolation on public.squad_member using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

insert into public.permission (code, resource, action, description) values
  ('squad.read',   'squad', 'read',   'Ver squads y su composicion'),
  ('squad.manage', 'squad', 'manage', 'Gestionar la membresia y funciones del squad')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (
     (p.code = 'squad.read'   and r.code in ('support_agent','support_lead','people_lead','change_manager','product_owner','auditor','ai_agent','system_admin','tenant_admin'))
  or (p.code = 'squad.manage' and r.code in ('people_lead','change_manager','system_admin','tenant_admin'))
)
where p.code in ('squad.read','squad.manage')
on conflict do nothing;
