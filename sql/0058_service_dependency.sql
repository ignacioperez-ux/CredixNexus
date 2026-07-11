-- 0058_service_dependency.sql
-- Grafo de dependencias a nivel de servicio (service -> service). Es DATO MAESTRO
-- declarado por el arquitecto (no se inventa la topologia): CRUD + validacion de ciclos
-- en la capa de app. Multi-tenant + RLS + auditado.
--
-- El resto del grafo (CI -> service, y CI/service/product afectados) se DERIVA de datos
-- reales ya existentes: configuration_item.service_id y la co-ocurrencia en incidentes.
-- Aqui no se siembra topologia de negocio (§2.1 / §11): la define el arquitecto.

create table if not exists public.service_dependency (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenant(id) on delete cascade,
  service_id            uuid not null references public.service(id) on delete cascade,
  depends_on_service_id uuid not null references public.service(id) on delete cascade,
  dependency_type       varchar(16) not null default 'sync' check (dependency_type in ('sync','async','data','infra','manual')),
  criticality           impact_level not null default 'medium',
  description           text,
  created_at            timestamptz not null default now(),
  created_by            uuid,
  updated_at            timestamptz not null default now(),
  updated_by            uuid,
  constraint chk_svcdep_no_self check (service_id <> depends_on_service_id),
  constraint uq_svcdep unique (tenant_id, service_id, depends_on_service_id)
);
create index if not exists idx_svcdep_tenant on public.service_dependency (tenant_id, service_id);
create index if not exists idx_svcdep_dep on public.service_dependency (tenant_id, depends_on_service_id);

drop trigger if exists trg_svcdep_updated on public.service_dependency;
create trigger trg_svcdep_updated before update on public.service_dependency for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_svcdep on public.service_dependency;
create trigger trg_audit_svcdep after insert or update or delete on public.service_dependency for each row execute function public.audit_row_change();

alter table public.service_dependency enable row level security;
drop policy if exists svcdep_isolation on public.service_dependency;
create policy svcdep_isolation on public.service_dependency for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
