-- ============================================================================
-- Credix Nexus — 0007 — CMDB base: service, configuration_item, ci_relationship
-- Los sistemas legacy (SAC, Prisma, MiCredix, Flip, Autocartera) se modelan aqui
-- como configuration_item (ci_type='system'), NO como tenants.
-- ============================================================================

create table if not exists public.service (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenant(id),
    code            varchar(80) not null,
    name            varchar(200) not null,
    service_type    varchar(80) not null,
    business_domain varchar(80) not null,
    owner_user_id   uuid null references public.user_account(id),
    criticality     impact_level not null default 'medium',
    status          record_status not null default 'active',
    metadata        jsonb not null default '{}'::jsonb,
    created_at      timestamptz not null default now(),
    created_by      uuid null,
    updated_at      timestamptz not null default now(),
    updated_by      uuid null,
    version_no      bigint not null default 1,
    constraint uq_service_code unique (tenant_id, code)
);
create index if not exists idx_service_tenant on public.service (tenant_id, status);

create table if not exists public.configuration_item (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenant(id),
    code                varchar(100) not null,
    name                varchar(250) not null,
    ci_type             varchar(80) not null,
    environment         varchar(40) not null default 'production',
    service_id          uuid null references public.service(id),
    owner_user_id       uuid null references public.user_account(id),
    criticality         impact_level not null default 'medium',
    data_classification varchar(80) not null default 'internal',
    status              record_status not null default 'active',
    metadata            jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now(),
    created_by          uuid null,
    updated_at          timestamptz not null default now(),
    updated_by          uuid null,
    version_no          bigint not null default 1,
    constraint uq_ci_code unique (tenant_id, code),
    constraint chk_ci_env check (environment in ('dev','test','uat','staging','production','dr'))
);
create index if not exists idx_ci_tenant  on public.configuration_item (tenant_id, status);
create index if not exists idx_ci_service on public.configuration_item (tenant_id, service_id, criticality);

create table if not exists public.ci_relationship (
    id                uuid primary key default gen_random_uuid(),
    tenant_id         uuid not null references public.tenant(id),
    parent_ci_id      uuid not null references public.configuration_item(id),
    child_ci_id       uuid not null references public.configuration_item(id),
    relationship_type varchar(80) not null,
    valid_from        timestamptz not null default now(),
    valid_to          timestamptz null,
    metadata          jsonb not null default '{}'::jsonb,
    constraint chk_ci_rel_no_self check (parent_ci_id <> child_ci_id),
    constraint chk_ci_rel_dates check (valid_to is null or valid_to >= valid_from)
);
create index if not exists idx_ci_rel_parent on public.ci_relationship (tenant_id, parent_ci_id);

-- ---- updated_at triggers ----
drop trigger if exists trg_service_updated on public.service;
create trigger trg_service_updated before update on public.service
  for each row execute function public.set_updated_at();
drop trigger if exists trg_ci_updated on public.configuration_item;
create trigger trg_ci_updated before update on public.configuration_item
  for each row execute function public.set_updated_at();

-- ---- audit triggers (ledger) ----
drop trigger if exists trg_audit_service on public.service;
create trigger trg_audit_service after insert or update or delete on public.service
  for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_ci on public.configuration_item;
create trigger trg_audit_ci after insert or update or delete on public.configuration_item
  for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_ci_rel on public.ci_relationship;
create trigger trg_audit_ci_rel after insert or update or delete on public.ci_relationship
  for each row execute function public.audit_row_change();

-- ---- RLS ----
alter table public.service enable row level security;
drop policy if exists service_isolation on public.service;
create policy service_isolation on public.service for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.configuration_item enable row level security;
drop policy if exists ci_isolation on public.configuration_item;
create policy ci_isolation on public.configuration_item for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.ci_relationship enable row level security;
drop policy if exists ci_rel_isolation on public.ci_relationship;
create policy ci_rel_isolation on public.ci_relationship for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
