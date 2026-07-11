-- ============================================================================
-- Credix Nexus — 0008 — Catalogo de canales y vinculo aplicacion<->canal
-- Aclaracion de modelo (feedback): SAC/Prisma/MiCredix/Flip/Autocartera son
-- APLICACIONES (productos de software, != productos financieros) gestionadas en
-- el catalogo de servicios (configuration_item ci_type='application') que
-- INTERACTUAN en canales. 'channel' es un catalogo de primera clase.
-- ============================================================================

create table if not exists public.channel (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenant(id),
    code         varchar(80) not null,
    name         varchar(200) not null,
    channel_type varchar(60) not null,   -- web|mobile|api|contact_center|branch|email|webhook|batch
    status       record_status not null default 'active',
    metadata     jsonb not null default '{}'::jsonb,
    created_at   timestamptz not null default now(),
    created_by   uuid null,
    updated_at   timestamptz not null default now(),
    updated_by   uuid null,
    version_no   bigint not null default 1,
    constraint uq_channel_code unique (tenant_id, code),
    constraint chk_channel_type check (channel_type in
        ('web','mobile','api','contact_center','branch','email','webhook','batch','portal_partner'))
);
create index if not exists idx_channel_tenant on public.channel (tenant_id, status);

-- Vinculo: una aplicacion (CI) interactua en un canal.
create table if not exists public.ci_channel (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenant(id),
    ci_id            uuid not null references public.configuration_item(id),
    channel_id       uuid not null references public.channel(id),
    interaction_type varchar(60) not null default 'serves',  -- serves|consumes|publishes
    status           record_status not null default 'active',
    metadata         jsonb not null default '{}'::jsonb,
    created_at       timestamptz not null default now(),
    created_by       uuid null,
    constraint uq_ci_channel unique (tenant_id, ci_id, channel_id, interaction_type)
);
create index if not exists idx_ci_channel_ci      on public.ci_channel (tenant_id, ci_id);
create index if not exists idx_ci_channel_channel on public.ci_channel (tenant_id, channel_id);

-- ---- updated_at + audit ----
drop trigger if exists trg_channel_updated on public.channel;
create trigger trg_channel_updated before update on public.channel
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_channel on public.channel;
create trigger trg_audit_channel after insert or update or delete on public.channel
  for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_ci_channel on public.ci_channel;
create trigger trg_audit_ci_channel after insert or update or delete on public.ci_channel
  for each row execute function public.audit_row_change();

-- ---- RLS ----
alter table public.channel enable row level security;
drop policy if exists channel_isolation on public.channel;
create policy channel_isolation on public.channel for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.ci_channel enable row level security;
drop policy if exists ci_channel_isolation on public.ci_channel;
create policy ci_channel_isolation on public.ci_channel for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
