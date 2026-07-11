-- ============================================================================
-- Credix Nexus — 0002 — Tenant e Identidad (multi-tenant fuerte)
-- tenant, party, party_role, user_account, role, permission, role_permission, user_role
-- ============================================================================

-- ---------------------------------------------------------------- tenant ----
create table if not exists public.tenant (
    id           uuid primary key default gen_random_uuid(),
    code         varchar(50) not null unique,
    name         varchar(200) not null,
    tenant_type  tenant_type not null,
    country_code char(2) not null default 'CR',
    timezone     varchar(80) not null default 'America/Costa_Rica',
    status       record_status not null default 'active',
    config_json  jsonb not null default '{}'::jsonb,
    created_at   timestamptz not null default now(),
    created_by   uuid null,
    updated_at   timestamptz not null default now(),
    updated_by   uuid null,
    version_no   bigint not null default 1,
    constraint chk_tenant_code_format check (code ~ '^[A-Z0-9_\-]{2,50}$')
);
comment on table public.tenant is 'Aislamiento multi-tenant. Cada dato operativo referencia un tenant.';

-- ----------------------------------------------------------------- party ----
create table if not exists public.party (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenant(id),
    party_type   party_type not null,
    external_ref varchar(100) null,
    legal_name   varchar(250) null,
    display_name varchar(250) not null,
    tax_id       varchar(80) null,
    email        citext null,
    phone        varchar(50) null,
    status       record_status not null default 'active',
    metadata     jsonb not null default '{}'::jsonb,
    created_at   timestamptz not null default now(),
    created_by   uuid null,
    updated_at   timestamptz not null default now(),
    updated_by   uuid null,
    version_no   bigint not null default 1,
    constraint uq_party_external unique (tenant_id, external_ref),
    constraint chk_party_name check (length(display_name) >= 2)
);
create index if not exists idx_party_tenant on public.party (tenant_id, status);

-- ------------------------------------------------------------ party_role ----
create table if not exists public.party_role (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenant(id),
    party_id   uuid not null references public.party(id),
    role_type  varchar(50) not null,
    valid_from date not null default current_date,
    valid_to   date null,
    status     record_status not null default 'active',
    metadata   jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    created_by uuid null,
    constraint chk_party_role_dates check (valid_to is null or valid_to >= valid_from),
    constraint uq_party_role unique (tenant_id, party_id, role_type, valid_from)
);
create index if not exists idx_party_role_party on public.party_role (tenant_id, party_id);

-- ---------------------------------------------------------- user_account ----
create table if not exists public.user_account (
    id                    uuid primary key default gen_random_uuid(),
    tenant_id             uuid not null references public.tenant(id),
    party_id              uuid null references public.party(id),
    auth_user_id          uuid null references auth.users(id) on delete set null,
    email                 citext not null,
    username              varchar(100) not null,
    full_name             varchar(200) not null,
    status                record_status not null default 'active',
    mfa_enabled           boolean not null default false,
    last_login_at         timestamptz null,
    password_auth_disabled boolean not null default false,
    identity_provider     varchar(80) null,
    external_subject      varchar(200) null,
    created_at            timestamptz not null default now(),
    created_by            uuid null,
    updated_at            timestamptz not null default now(),
    updated_by            uuid null,
    version_no            bigint not null default 1,
    constraint uq_user_email    unique (tenant_id, email),
    constraint uq_user_username unique (tenant_id, username)
);
create index if not exists idx_user_auth on public.user_account (auth_user_id);
comment on column public.user_account.auth_user_id is 'FK a auth.users de Supabase (sesion autenticada).';

-- ------------------------------------------------------------------ role ----
create table if not exists public.role (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid null references public.tenant(id),   -- null = rol global/sistema
    code        varchar(80) not null,
    name        varchar(150) not null,
    description text null,
    is_system   boolean not null default false,
    status      record_status not null default 'active'
);
-- unicidad de codigo: por tenant y (aparte) global (tenant_id null)
create unique index if not exists uq_role_code_tenant on public.role (tenant_id, code) where tenant_id is not null;
create unique index if not exists uq_role_code_global on public.role (code) where tenant_id is null;

-- ------------------------------------------------------------ permission ----
create table if not exists public.permission (
    id          uuid primary key default gen_random_uuid(),
    code        varchar(120) not null unique,
    resource    varchar(80) not null,
    action      varchar(80) not null,
    description text null
);

-- ------------------------------------------------------- role_permission ----
create table if not exists public.role_permission (
    role_id       uuid not null references public.role(id) on delete cascade,
    permission_id uuid not null references public.permission(id) on delete cascade,
    primary key (role_id, permission_id)
);

-- ------------------------------------------------------------- user_role ----
create table if not exists public.user_role (
    user_id    uuid not null references public.user_account(id) on delete cascade,
    role_id    uuid not null references public.role(id) on delete cascade,
    scope_type varchar(50) null,
    scope_id   uuid null,
    valid_from timestamptz not null default now(),
    valid_to   timestamptz null,
    primary key (user_id, role_id, valid_from),
    constraint chk_user_role_dates check (valid_to is null or valid_to >= valid_from)
);

-- ---- Triggers updated_at en tablas con la columna ----
drop trigger if exists trg_tenant_updated on public.tenant;
create trigger trg_tenant_updated before update on public.tenant
  for each row execute function public.set_updated_at();

drop trigger if exists trg_party_updated on public.party;
create trigger trg_party_updated before update on public.party
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_updated on public.user_account;
create trigger trg_user_updated before update on public.user_account
  for each row execute function public.set_updated_at();

-- ---- Helper: tenant activo del contexto ----
-- Prioridad: GUC app.current_tenant_id (operaciones server-side) ->
--            tenant del usuario autenticado (auth.uid()).
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    nullif(current_setting('app.current_tenant_id', true), '')::uuid,
    (select ua.tenant_id
       from public.user_account ua
      where ua.auth_user_id = auth.uid()
      limit 1)
  );
$$;
comment on function public.current_tenant_id() is
  'Tenant del contexto: GUC app.current_tenant_id o, en su defecto, el tenant del usuario autenticado.';
