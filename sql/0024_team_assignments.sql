-- ============================================================================
-- Credix Nexus — 0024 — Personas (team_member) y asignaciones PO/UX/Dev + Peso
-- Matriz activo -> PO / UX / Dev / Peso. asset_assignment es generico (aplica a
-- configuration_item, channel, process). El Peso es la prioridad del activo (0-3).
-- ============================================================================

create table if not exists public.team_member (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenant(id),
    name       varchar(120) not null,
    user_id    uuid null references public.user_account(id),
    status     record_status not null default 'active',
    created_at timestamptz not null default now(),
    created_by uuid null,
    constraint uq_team_member unique (tenant_id, name)
);

create table if not exists public.asset_assignment (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenant(id),
    entity_type    varchar(80) not null,   -- configuration_item | channel | process
    entity_id      uuid not null,
    po_member_id   uuid null references public.team_member(id),
    ux_member_id   uuid null references public.team_member(id),
    dev_member_id  uuid null references public.team_member(id),
    weight         integer not null default 0,
    metadata       jsonb not null default '{}'::jsonb,
    created_at     timestamptz not null default now(),
    created_by     uuid null,
    updated_at     timestamptz not null default now(),
    updated_by     uuid null,
    version_no     bigint not null default 1,
    constraint uq_asset_assignment unique (entity_type, entity_id),
    constraint chk_asset_weight check (weight >= 0)
);
create index if not exists idx_asset_assignment on public.asset_assignment (tenant_id, entity_type, entity_id);

drop trigger if exists trg_asset_assignment_updated on public.asset_assignment;
create trigger trg_asset_assignment_updated before update on public.asset_assignment for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_asset_assignment on public.asset_assignment;
create trigger trg_audit_asset_assignment after insert or update or delete on public.asset_assignment for each row execute function public.audit_row_change();

alter table public.team_member enable row level security;
drop policy if exists team_member_isolation on public.team_member;
create policy team_member_isolation on public.team_member for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.asset_assignment enable row level security;
drop policy if exists asset_assignment_isolation on public.asset_assignment;
create policy asset_assignment_isolation on public.asset_assignment for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- NOTA: la matriz PO/UX/Dev/peso y la composicion de squads son IDEAS en
-- construccion del equipo de Credix, aun NO formalizadas. La estructura queda lista
-- para absorberlas (versionada), pero no se siembran como dato autoritativo.
-- Solo se siembran las personas conocidas como demo.
insert into public.team_member (tenant_id, name)
select t.id, n from public.tenant t, unnest(array[
  'Mike','David','Stefano','Beatriz','Keila','Pedro','Kevin','Miguel','Fabiola','Adriana',
  'Iveth','Michael V','Lucia N','Viviana P','Stephanie C'
]) as n where t.code='CORE' on conflict (tenant_id, name) do nothing;
