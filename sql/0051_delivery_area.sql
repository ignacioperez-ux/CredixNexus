-- 0051_delivery_area.sql
-- F2: Areas de entrega (Operaciones vs Evolucion) con lider y delegado.
-- Operaciones (Gissele Arias) es duena de las incidencias; Evolucion (Daniel Blohm)
-- de proyectos y mejoras. El caso/proyecto se enruta al area. El lider se guarda por
-- nombre; lead_user_id queda opcional para vincular un login cuando exista.
-- Multi-tenant + RLS + auditado.

create table if not exists public.delivery_area (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant(id) on delete cascade,
  code           varchar(20) not null check (code in ('operations','evolution')),
  name           varchar(120) not null,
  description    text,
  lead_name      varchar(150),
  lead_email     varchar(200),
  lead_user_id   uuid references public.user_account(id) on delete set null,
  deputy_name    varchar(150),
  deputy_email   varchar(200),
  deputy_user_id uuid references public.user_account(id) on delete set null,
  status         record_status not null default 'active',
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  constraint delivery_area_code_unique unique (tenant_id, code)
);
create index if not exists idx_delivery_area_tenant on public.delivery_area (tenant_id);

-- Ruteo: la incidencia/proyecto pertenece a un area de entrega.
alter table public.incident add column if not exists delivery_area_id uuid references public.delivery_area(id) on delete set null;
alter table public.project  add column if not exists delivery_area_id uuid references public.delivery_area(id) on delete set null;
create index if not exists idx_incident_area on public.incident (delivery_area_id);
create index if not exists idx_project_area on public.project (delivery_area_id);

drop trigger if exists trg_delivery_area_updated on public.delivery_area;
create trigger trg_delivery_area_updated before update on public.delivery_area for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_delivery_area on public.delivery_area;
create trigger trg_audit_delivery_area after insert or update or delete on public.delivery_area for each row execute function public.audit_row_change();

alter table public.delivery_area enable row level security;
drop policy if exists delivery_area_isolation on public.delivery_area;
create policy delivery_area_isolation on public.delivery_area using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- Ruteo automatico: la incidencia entra a Operaciones; el proyecto a Evolucion.
create or replace function public.set_incident_delivery_area()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.delivery_area_id is null then
    new.delivery_area_id := (select id from public.delivery_area where tenant_id = new.tenant_id and code = 'operations' limit 1);
  end if;
  return new;
end $$;
drop trigger if exists trg_incident_area on public.incident;
create trigger trg_incident_area before insert on public.incident for each row execute function public.set_incident_delivery_area();

create or replace function public.set_project_delivery_area()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.delivery_area_id is null then
    new.delivery_area_id := (select id from public.delivery_area where tenant_id = new.tenant_id and code = 'evolution' limit 1);
  end if;
  return new;
end $$;
drop trigger if exists trg_project_area on public.project;
create trigger trg_project_area before insert on public.project for each row execute function public.set_project_delivery_area();

insert into public.permission (code, resource, action, description) values
  ('area.read',   'delivery_area', 'read',   'Ver areas de entrega y sus lideres'),
  ('area.manage', 'delivery_area', 'manage', 'Gestionar areas de entrega y lideres')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (
     (p.code = 'area.read'   and r.code in ('support_agent','support_lead','people_lead','change_manager','auditor','ai_agent','system_admin','tenant_admin'))
  or (p.code = 'area.manage' and r.code in ('system_admin','tenant_admin'))
)
where p.code in ('area.read','area.manage')
on conflict do nothing;

-- Seed de las dos areas con sus lideres (por nombre) para cada tenant.
insert into public.delivery_area (tenant_id, code, name, description, lead_name)
select t.id, v.code, v.name, v.descr, v.lead
from public.tenant t
cross join (values
  ('operations', 'Operaciones', 'Gestion de incidencias del dia a dia (mesa de ayuda / soporte).', 'Gissele Arias'),
  ('evolution',  'Evolucion',   'Transformacion: proyectos y mejoras, analisis, priorizacion y pase a produccion controlado.', 'Daniel Blohm')
) as v(code, name, descr, lead)
on conflict (tenant_id, code) do nothing;

-- Backfill: incidencias existentes a Operaciones, proyectos a Evolucion.
update public.incident i set delivery_area_id = (select id from public.delivery_area d where d.tenant_id = i.tenant_id and d.code = 'operations')
where i.delivery_area_id is null;
update public.project p set delivery_area_id = (select id from public.delivery_area d where d.tenant_id = p.tenant_id and d.code = 'evolution')
where p.delivery_area_id is null;
