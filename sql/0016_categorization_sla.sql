-- ============================================================================
-- Credix Nexus — 0016 — Categorizacion (ITIL) + SLA
-- La categoria maneja la gestion: equipo por defecto, prioridad sugerida,
-- si requiere RCA y si requiere articulo de conocimiento (KB). SLA por prioridad.
-- ============================================================================

-- ------------------------------------------------------ incident_category ----
create table if not exists public.incident_category (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenant(id),
    code               varchar(80) not null,
    name               varchar(200) not null,
    parent_category_id uuid null references public.incident_category(id),
    default_team       varchar(100) null,
    default_priority   priority_level null,
    requires_rca       boolean not null default false,
    requires_kb        boolean not null default false,
    status             record_status not null default 'active',
    metadata           jsonb not null default '{}'::jsonb,
    created_at         timestamptz not null default now(),
    created_by         uuid null,
    updated_at         timestamptz not null default now(),
    updated_by         uuid null,
    version_no         bigint not null default 1,
    constraint uq_incident_category_code unique (tenant_id, code)
);
create index if not exists idx_inc_cat_parent on public.incident_category (tenant_id, parent_category_id);

-- Vinculo del incidente a la categoria catalogada (ademas del texto libre legacy).
alter table public.incident add column if not exists category_id uuid null references public.incident_category(id);
create index if not exists idx_incident_category on public.incident (tenant_id, category_id);

-- --------------------------------------------------------------- sla_policy ----
create table if not exists public.sla_policy (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenant(id),
    priority           priority_level not null,
    response_minutes   integer not null,
    resolution_minutes integer not null,
    status             record_status not null default 'active',
    created_at         timestamptz not null default now(),
    created_by         uuid null,
    updated_at         timestamptz not null default now(),
    updated_by         uuid null,
    version_no         bigint not null default 1,
    constraint uq_sla_policy unique (tenant_id, priority),
    constraint chk_sla_minutes check (response_minutes > 0 and resolution_minutes >= response_minutes)
);

-- Columnas SLA en el incidente (targets calculados; el breach se evalua en consulta).
alter table public.incident add column if not exists sla_response_due_at   timestamptz null;
alter table public.incident add column if not exists sla_resolution_due_at timestamptz null;

-- Trigger: al crear el incidente, fija los targets SLA segun la politica de su prioridad.
create or replace function public.set_incident_sla()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_resp int; v_reso int;
begin
    select response_minutes, resolution_minutes into v_resp, v_reso
      from public.sla_policy
     where tenant_id = new.tenant_id and priority = new.priority and status = 'active'
     limit 1;
    if v_resp is not null then
        new.sla_response_due_at   := coalesce(new.sla_response_due_at,   new.opened_at + make_interval(mins => v_resp));
        new.sla_resolution_due_at := coalesce(new.sla_resolution_due_at, new.opened_at + make_interval(mins => v_reso));
    end if;
    return new;
end $$;
drop trigger if exists trg_incident_sla on public.incident;
create trigger trg_incident_sla before insert on public.incident
  for each row execute function public.set_incident_sla();

-- ---- updated_at + audit ----
drop trigger if exists trg_inc_cat_updated on public.incident_category;
create trigger trg_inc_cat_updated before update on public.incident_category for each row execute function public.set_updated_at();
drop trigger if exists trg_sla_updated on public.sla_policy;
create trigger trg_sla_updated before update on public.sla_policy for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_inc_cat on public.incident_category;
create trigger trg_audit_inc_cat after insert or update or delete on public.incident_category for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_sla on public.sla_policy;
create trigger trg_audit_sla after insert or update or delete on public.sla_policy for each row execute function public.audit_row_change();

-- ---- RLS ----
alter table public.incident_category enable row level security;
drop policy if exists inc_cat_isolation on public.incident_category;
create policy inc_cat_isolation on public.incident_category for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.sla_policy enable row level security;
drop policy if exists sla_isolation on public.sla_policy;
create policy sla_isolation on public.sla_policy for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- =============================== Seed categorias + SLA =========================
insert into public.incident_category (tenant_id, code, name, default_team, default_priority, requires_rca, requires_kb)
select t.id, v.code, v.name, v.team, v.prio::priority_level, v.rca, v.kb
from public.tenant t join (values
  ('RECONCILIATION','Conciliacion / Datos','Equipo Conciliacion','p2_high', true,  true),
  ('PAYMENTS','Pagos','Equipo Pagos','p1_critical', true, true),
  ('ONBOARDING','Onboarding / Originacion','Equipo Onboarding','p3_medium', false, true),
  ('APPLICATION','Aplicaciones','Soporte Aplicaciones','p3_medium', false, true),
  ('ACCESS','Acceso / Identidad','Mesa de Ayuda','p4_low', false, false),
  ('SECURITY','Seguridad','Equipo Seguridad','p1_critical', true, true),
  ('INFRASTRUCTURE','Infraestructura','Equipo Infra','p2_high', false, false),
  ('DATA_QUALITY','Calidad de Datos','Gobierno de Datos','p2_high', true, true)
) as v(code,name,team,prio,rca,kb) on true
where t.code='CORE' on conflict (tenant_id, code) do nothing;

insert into public.sla_policy (tenant_id, priority, response_minutes, resolution_minutes)
select t.id, v.prio::priority_level, v.resp, v.reso
from public.tenant t join (values
  ('p1_critical', 15, 240),
  ('p2_high', 30, 480),
  ('p3_medium', 240, 1440),
  ('p4_low', 480, 4320)
) as v(prio,resp,reso) on true
where t.code='CORE' on conflict (tenant_id, priority) do nothing;

-- Backfill: vincula categoria y SLA a los incidentes demo existentes.
update public.incident i set category_id = c.id
from public.incident_category c
where c.tenant_id = i.tenant_id and i.category_id is null
  and c.code = case i.category
    when 'reconciliation' then 'RECONCILIATION'
    when 'payments' then 'PAYMENTS'
    when 'onboarding' then 'ONBOARDING'
    when 'access' then 'ACCESS'
    else 'APPLICATION' end;

update public.incident i
set sla_response_due_at   = i.opened_at + make_interval(mins => p.response_minutes),
    sla_resolution_due_at = i.opened_at + make_interval(mins => p.resolution_minutes)
from public.sla_policy p
where p.tenant_id = i.tenant_id and p.priority = i.priority and i.sla_resolution_due_at is null;
