-- 0065_process_governance.sql
-- Gobierno de datos (TO-BE F4): Ficha de Proceso + matrices RACI.
-- El proceso ya existe (jerarquia macro/proceso/micro, con business_unit dueno = accountable).
-- Aqui se agregan las matrices que faltaban: proceso -> sistema (que CIs soportan cada proceso,
-- con su rol) y producto -> canal (por que canales se ofrece cada producto). Son DATO MAESTRO
-- que declara el arquitecto (no se inventa la topologia, §2.1): CRUD + validacion. RLS + auditado.

-- ---- Matriz proceso -> sistema ----
create table if not exists public.process_system (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  process_id   uuid not null references public.process(id) on delete cascade,
  ci_id        uuid not null references public.configuration_item(id) on delete cascade,
  role         varchar(16) not null default 'primary' check (role in ('primary','secondary','integration','manual')),
  criticality  impact_level not null default 'medium',
  notes        text,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  constraint uq_process_system unique (process_id, ci_id)
);
create index if not exists idx_process_system_proc on public.process_system (tenant_id, process_id);
create index if not exists idx_process_system_ci on public.process_system (tenant_id, ci_id);

-- ---- Matriz producto -> canal ----
create table if not exists public.product_channel (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  product_id   uuid not null references public.product(id) on delete cascade,
  channel_id   uuid not null references public.channel(id) on delete cascade,
  availability varchar(12) not null default 'active' check (availability in ('active','pilot','retired')),
  notes        text,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  constraint uq_product_channel unique (product_id, channel_id)
);
create index if not exists idx_product_channel_prod on public.product_channel (tenant_id, product_id);

-- ---- updated_at + audit ----
drop trigger if exists trg_process_system_updated on public.process_system;
create trigger trg_process_system_updated before update on public.process_system for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_process_system on public.process_system;
create trigger trg_audit_process_system after insert or update or delete on public.process_system for each row execute function public.audit_row_change();
drop trigger if exists trg_product_channel_updated on public.product_channel;
create trigger trg_product_channel_updated before update on public.product_channel for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_product_channel on public.product_channel;
create trigger trg_audit_product_channel after insert or update or delete on public.product_channel for each row execute function public.audit_row_change();

-- ---- RLS ----
alter table public.process_system enable row level security;
drop policy if exists process_system_isolation on public.process_system;
create policy process_system_isolation on public.process_system for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
alter table public.product_channel enable row level security;
drop policy if exists product_channel_isolation on public.product_channel;
create policy product_channel_isolation on public.product_channel for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- ---- permisos ----
insert into public.permission (code, resource, action, description) values
  ('process.read',   'process', 'read',   'Ver fichas de proceso y matrices de gobierno'),
  ('process.manage', 'process', 'manage', 'Administrar matrices proceso-sistema y producto-canal')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id from public.permission p join public.role r on (
     (p.code='process.read'   and r.code in ('support_agent','support_lead','change_manager','grc_officer','business_owner','product_owner','people_lead','auditor','system_admin','tenant_admin'))
  or (p.code='process.manage' and r.code in ('grc_officer','business_owner','change_manager','system_admin','tenant_admin'))
)
where p.code in ('process.read','process.manage')
on conflict do nothing;
