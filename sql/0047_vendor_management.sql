-- 0047_vendor_management.sql
-- Vendor / Supplier Management (ITIL 4 / F-Fin4). Los proveedores (companias que
-- proveen sistemas/servicios) son un dato maestro con criticidad y contrato. Se
-- vinculan a los CIs (sistemas/aplicaciones); asi los incidentes que afectan esos
-- sistemas se atribuyen al proveedor (senal de desempeno). Multi-tenant + RLS + auditado.

create table if not exists public.vendor (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant(id) on delete cascade,
  code             varchar(40) not null,
  name             varchar(200) not null,
  legal_name       varchar(250),
  category         varchar(20) not null default 'other'
                     check (category in ('payment_processor','core_banking','infrastructure','saas','data_provider','security','consulting','other')),
  criticality      varchar(8) not null default 'medium'
                     check (criticality in ('low','medium','high','critical')),
  status           record_status not null default 'active',
  contact_name     varchar(150),
  contact_email    varchar(200),
  contact_phone    varchar(50),
  website          varchar(300),
  contract_number  varchar(80),
  contract_start   date,
  contract_end     date,
  sla_terms        text,
  notes            text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  constraint vendor_code_unique unique (tenant_id, code),
  -- Vigencia de contrato: fin no anterior al inicio (§10.3, ambos sentidos)
  constraint vendor_contract_window check (contract_end is null or contract_start is null or contract_end >= contract_start)
);
create index if not exists idx_vendor_tenant on public.vendor (tenant_id, status);

-- Un CI (sistema/aplicacion) es provisto por un proveedor.
alter table public.configuration_item add column if not exists vendor_id uuid references public.vendor(id) on delete set null;
create index if not exists idx_ci_vendor on public.configuration_item (vendor_id);

create or replace function public.set_vendor_code()
returns trigger language plpgsql
set search_path = public as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.next_document_number(new.tenant_id, 'vendor', 'VND');
  end if;
  return new;
end $$;

drop trigger if exists trg_vendor_code on public.vendor;
create trigger trg_vendor_code before insert on public.vendor for each row execute function public.set_vendor_code();
drop trigger if exists trg_vendor_updated on public.vendor;
create trigger trg_vendor_updated before update on public.vendor for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_vendor on public.vendor;
create trigger trg_audit_vendor after insert or update or delete on public.vendor for each row execute function public.audit_row_change();

alter table public.vendor enable row level security;
drop policy if exists vendor_isolation on public.vendor;
create policy vendor_isolation on public.vendor using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

insert into public.permission (code, resource, action, description) values
  ('vendor.read',   'vendor', 'read',   'Ver proveedores y su desempeno'),
  ('vendor.manage', 'vendor', 'manage', 'Gestionar proveedores y contratos')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (
     (p.code = 'vendor.read'   and r.code in ('support_agent','support_lead','auditor','ai_agent','system_admin','tenant_admin','change_manager','grc_officer','product_owner'))
  or (p.code = 'vendor.manage' and r.code in ('change_manager','grc_officer','system_admin','tenant_admin'))
)
where p.code in ('vendor.read','vendor.manage')
on conflict do nothing;
