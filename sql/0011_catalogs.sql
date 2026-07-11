-- ============================================================================
-- Credix Nexus — 0011 — Catalogos de negocio: business_unit, process, product
-- Modelo vivo/versionado (spec anexo §1-3). Jerarquia de procesos de 3 niveles
-- (macro->process->micro) via self-reference. Producto financiero != aplicacion.
-- ============================================================================

-- Helper: genera un code legible desde un nombre (sin acentos, upper, _).
create or replace function public.slug_code(p text)
returns text language sql immutable set search_path = public as $$
  select upper(trim(both '_' from regexp_replace(
    translate(p,
      'áàäâéèëêíìïîóòöôúùüûñÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑ',
      'aaaaeeeeiiiioooouuuunAAAAEEEEIIIIOOOOUUUUN'),
    '[^a-zA-Z0-9]+', '_', 'g')));
$$;

do $$ begin
  create type process_level as enum ('macro','process','micro');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------- business_unit ----
create table if not exists public.business_unit (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenant(id),
    code       varchar(80) not null,
    name       varchar(200) not null,
    status     record_status not null default 'active',
    metadata   jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    created_by uuid null,
    updated_at timestamptz not null default now(),
    updated_by uuid null,
    version_no bigint not null default 1,
    constraint uq_bu_code unique (tenant_id, code)
);

-- ----------------------------------------------------------------- process ----
create table if not exists public.process (
    id                uuid primary key default gen_random_uuid(),
    tenant_id         uuid not null references public.tenant(id),
    code              varchar(120) not null,
    name              varchar(250) not null,
    process_level     process_level not null default 'process',
    parent_process_id uuid null references public.process(id),
    business_unit_id  uuid null references public.business_unit(id),
    objective         text null,
    status            record_status not null default 'active',
    metadata          jsonb not null default '{}'::jsonb,
    created_at        timestamptz not null default now(),
    created_by        uuid null,
    updated_at        timestamptz not null default now(),
    updated_by        uuid null,
    version_no        bigint not null default 1,
    constraint uq_process_code unique (tenant_id, code)
);
create index if not exists idx_process_parent on public.process (tenant_id, parent_process_id);
create index if not exists idx_process_bu     on public.process (tenant_id, business_unit_id);

-- ----------------------------------------------------------------- product ----
-- Producto FINANCIERO de Credix (catalogo). Distinto de aplicacion (CI) y de tenant.
create table if not exists public.product (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenant(id),
    code             varchar(120) not null,
    name             varchar(250) not null,
    product_family   varchar(120) null,
    business_unit_id uuid null references public.business_unit(id),
    status           record_status not null default 'active',
    metadata         jsonb not null default '{}'::jsonb,
    created_at       timestamptz not null default now(),
    created_by       uuid null,
    updated_at       timestamptz not null default now(),
    updated_by       uuid null,
    version_no       bigint not null default 1,
    constraint uq_product_code unique (tenant_id, code)
);

-- ---- updated_at + audit en los 3 catalogos ----
drop trigger if exists trg_bu_updated on public.business_unit;
create trigger trg_bu_updated before update on public.business_unit for each row execute function public.set_updated_at();
drop trigger if exists trg_process_updated on public.process;
create trigger trg_process_updated before update on public.process for each row execute function public.set_updated_at();
drop trigger if exists trg_product_updated on public.product;
create trigger trg_product_updated before update on public.product for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_bu on public.business_unit;
create trigger trg_audit_bu after insert or update or delete on public.business_unit for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_process on public.process;
create trigger trg_audit_process after insert or update or delete on public.process for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_product on public.product;
create trigger trg_audit_product after insert or update or delete on public.product for each row execute function public.audit_row_change();

-- ---- RLS ----
alter table public.business_unit enable row level security;
drop policy if exists bu_isolation on public.business_unit;
create policy bu_isolation on public.business_unit for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.process enable row level security;
drop policy if exists process_isolation on public.process;
create policy process_isolation on public.process for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.product enable row level security;
drop policy if exists product_isolation on public.product;
create policy product_isolation on public.product for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- ---- Extender channel_type para canales de comunicacion reales ----
alter table public.channel drop constraint if exists chk_channel_type;
alter table public.channel add constraint chk_channel_type check (channel_type in
  ('web','mobile','api','contact_center','branch','email','webhook','batch','portal_partner',
   'phone','whatsapp','social','chat','kiosk','assisted','sms'));
