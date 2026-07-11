-- ============================================================================
-- Credix Nexus — 0005 — Correccion de modelo: tenant = MODO operativo
-- El tenant es una figura amplia (frontera de operacion/entrega), NO un producto
-- ni un rol de party. Los roles (originator/investor/buyer/merchant) viven en
-- party_role. Reemplaza tenant_type (que mezclaba roles) por operating_mode.
-- ============================================================================

do $$ begin
  create type tenant_mode as enum ('saas','bpo','enterprise','internal','marketplace');
exception when duplicate_object then null; end $$;

-- Nueva columna de modo + mapeo desde los valores viejos
alter table public.tenant add column if not exists operating_mode tenant_mode;

update public.tenant set operating_mode = case tenant_type::text
    when 'internal'   then 'internal'::tenant_mode
    when 'group'      then 'enterprise'::tenant_mode
    when 'partner'    then 'enterprise'::tenant_mode
    when 'originator' then 'saas'::tenant_mode
    when 'investor'   then 'saas'::tenant_mode
    when 'buyer'      then 'saas'::tenant_mode
    else 'enterprise'::tenant_mode
  end
where operating_mode is null;

alter table public.tenant alter column operating_mode set not null;

-- Quitar la columna vieja y su enum (ya no se usa)
alter table public.tenant drop column if exists tenant_type;
drop type if exists tenant_type;

comment on column public.tenant.operating_mode is
  'Modo operativo/de entrega del tenant (saas|bpo|enterprise|internal|marketplace). NO es un producto ni un rol de party.';
comment on table public.tenant is
  'Tenant = frontera de operacion/entrega (modo). Figura amplia, distinta de Product y de los roles de Party.';
