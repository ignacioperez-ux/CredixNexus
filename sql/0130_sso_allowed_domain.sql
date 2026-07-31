-- ============================================================================
-- Credix Nexus — 0130 — Maestro de dominios permitidos para SSO (JIT provisioning)
-- ----------------------------------------------------------------------------
-- Habilita el aprovisionamiento "just-in-time" del login federado (Entra ID): un
-- empleado de Credix que entra por Azure con un email de un dominio ACTIVO aqui
-- listado obtiene, en su primer ingreso, una user_account en el tenant mapeado con
-- el rol por defecto (partner_user). El trigger handle_new_user() (0131) consulta
-- esta tabla. Ver docs/auth/SSO_ACTIVE_DIRECTORY_PLAN.md y CLAUDE.md §10/§11.
--
-- Dato maestro administrable: RLS por tenant, soft delete (status), auditoria via
-- ledger (trg audit_row_change), unicidad global de dominio (un dominio = un tenant,
-- para que el JIT sea determinista). Espeja el patron de 0129/0008.
--
-- Seed VACIO a proposito: los dominios se cargan el "dia D" desde la pantalla de
-- Datos Maestros (o por SQL controlado). Con la tabla vacia el JIT no aprovisiona
-- a nadie => comportamiento identico a hoy hasta que TI cargue 'credix.com'.
-- IDEMPOTENTE. ROLLBACK al pie.
-- ============================================================================

create table if not exists public.sso_allowed_domain (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenant(id),
    domain          citext not null,                          -- ej. credix.com (case-insensitive)
    default_role_id uuid not null references public.role(id), -- rol JIT (partner_user)
    status          record_status not null default 'active',  -- soft delete / desactivacion
    notes           text null,
    metadata        jsonb not null default '{}'::jsonb,
    created_at      timestamptz not null default now(),
    created_by      uuid null,
    updated_at      timestamptz not null default now(),
    updated_by      uuid null,
    version_no      bigint not null default 1,
    -- Unicidad GLOBAL del dominio: un dominio corporativo pertenece a un solo tenant
    -- (JIT determinista). citext => case-insensitive.
    constraint uq_sso_domain_global unique (domain),
    -- Formato basico de dominio (al menos un punto, sin espacios ni @).
    constraint chk_sso_domain_format check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
);
create index if not exists idx_sso_domain_tenant on public.sso_allowed_domain (tenant_id, status);
create index if not exists idx_sso_domain_active on public.sso_allowed_domain (domain) where status = 'active';

comment on table public.sso_allowed_domain is
  'Dominios corporativos habilitados para aprovisionamiento JIT via SSO (Entra ID). Un dominio activo => primer login federado crea user_account + default_role en el tenant mapeado.';

-- ---- updated_at + auditoria (ledger inmutable) ----
drop trigger if exists trg_sso_domain_updated on public.sso_allowed_domain;
create trigger trg_sso_domain_updated before update on public.sso_allowed_domain
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_sso_domain on public.sso_allowed_domain;
create trigger trg_audit_sso_domain after insert or update or delete on public.sso_allowed_domain
  for each row execute function public.audit_row_change();

-- ---- RLS (aislamiento por tenant) ----
alter table public.sso_allowed_domain enable row level security;
drop policy if exists sso_domain_isolation on public.sso_allowed_domain;
create policy sso_domain_isolation on public.sso_allowed_domain for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- ---- Ejemplo (NO se ejecuta): cargar el dominio corporativo el dia D ----
-- insert into public.sso_allowed_domain (tenant_id, domain, default_role_id)
-- select t.id, 'credix.com', r.id
-- from public.tenant t
-- join public.role r on r.tenant_id is null and r.code = 'partner_user'
-- where t.code = 'CORE' and t.status = 'active'
-- on conflict (domain) do nothing;

-- =============================================================================
-- ROLLBACK (volver al estado previo a esta migracion):
--   drop table if exists public.sso_allowed_domain cascade;
-- =============================================================================
