-- 0087_service_category.sql
-- Datos maestros (§10) para las CATEGORIAS del catalogo de servicios, con i18n ES/EN.
-- Antes: service_item.category era texto libre en espanol (UX-010). Ahora: maestro formal con
-- code + name_es + name_en, FK desde service_item, RLS por tenant, auditoria y soft-delete (status).

create table if not exists public.service_category (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  code varchar(60) not null,
  name_es varchar(120) not null,
  name_en varchar(120) not null,
  sort_order int not null default 0,
  status varchar(16) not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint service_category_code_uq unique (tenant_id, code),
  constraint service_category_status_chk check (status in ('active','inactive'))
);
create index if not exists ix_service_category_tenant on public.service_category(tenant_id);

alter table public.service_category enable row level security;
drop policy if exists service_category_isolation on public.service_category;
create policy service_category_isolation on public.service_category for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

drop trigger if exists trg_service_category_updated on public.service_category;
create trigger trg_service_category_updated before update on public.service_category
  for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_service_category on public.service_category;
create trigger trg_audit_service_category after insert or update or delete on public.service_category
  for each row execute function public.audit_row_change();

-- FK en service_item (nullable; ON DELETE SET NULL para no bloquear el maestro).
alter table public.service_item add column if not exists category_id uuid references public.service_category(id) on delete set null;
create index if not exists ix_service_item_category on public.service_item(category_id);

-- Seed de las categorias existentes + 'general' (default de createItem), con i18n, para TODO
-- tenant que tenga items en el catalogo (multi-tenant).
insert into public.service_category (tenant_id, code, name_es, name_en, sort_order)
select distinct si.tenant_id, v.code, v.es, v.en, v.ord
from public.service_item si
cross join (values
  ('acceso',  'Acceso',  'Access',  1),
  ('datos',   'Datos',   'Data',    2),
  ('general', 'General', 'General', 3)
) as v(code, es, en, ord)
on conflict (tenant_id, code) do nothing;

-- Backfill: enlaza items existentes a su categoria por code (case-insensitive).
update public.service_item si
   set category_id = sc.id
  from public.service_category sc
 where sc.tenant_id = si.tenant_id and lower(sc.code) = lower(si.category) and si.category_id is null;
