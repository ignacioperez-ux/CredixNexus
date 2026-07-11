-- ============================================================================
-- Credix Nexus — 0021 — Squads de Evolucion + convencion de asignaciones
-- Estructura organizativa (se asigna via user_role.scope_type/scope_id):
--   RC (responsable_comercial): scope_type='business_unit', scope_id=<BU>   (1 por area)
--   PO (product_owner):         scope_type='product',       scope_id=<producto> (1+ por PO)
--   PO -> squad:                scope_type='squad',          scope_id=<squad>
-- 'squad' es la nueva entidad; las asignaciones no requieren tablas extra.
-- ============================================================================

create table if not exists public.squad (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenant(id),
    code             varchar(80) not null,
    name             varchar(200) not null,
    business_unit_id uuid null references public.business_unit(id),
    status           record_status not null default 'active',
    metadata         jsonb not null default '{}'::jsonb,
    created_at       timestamptz not null default now(),
    created_by       uuid null,
    updated_at       timestamptz not null default now(),
    updated_by       uuid null,
    version_no       bigint not null default 1,
    constraint uq_squad_code unique (tenant_id, code)
);
create index if not exists idx_squad_bu on public.squad (tenant_id, business_unit_id);

drop trigger if exists trg_squad_updated on public.squad;
create trigger trg_squad_updated before update on public.squad for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_squad on public.squad;
create trigger trg_audit_squad after insert or update or delete on public.squad for each row execute function public.audit_row_change();

alter table public.squad enable row level security;
drop policy if exists squad_isolation on public.squad;
create policy squad_isolation on public.squad for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- Seed de squads demo, alineados a unidades de negocio
insert into public.squad (tenant_id, code, name, business_unit_id)
select t.id, public.slug_code(v.name), v.name, bu.id
from public.tenant t
join (values
  ('Squad Pagos','MEDIOS_DE_PAGO'),
  ('Squad Conciliacion','MEDIOS_DE_PAGO'),
  ('Squad Onboarding','PRESTAMOS'),
  ('Squad Cobranza','COBRANZA'),
  ('Squad Datos','PRESTAMOS')
) as v(name, bu_code) on true
left join public.business_unit bu on bu.tenant_id = t.id and bu.code = v.bu_code
where t.code='CORE'
on conflict (tenant_id, code) do nothing;
