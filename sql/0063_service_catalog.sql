-- 0063_service_catalog.sql
-- Catalogo de servicios solicitables (Request Fulfillment, ITIL). Cada item define un
-- formulario dinamico (form_schema), un SLA de cumplimiento y, opcionalmente, un workflow
-- que se dispara al solicitar. Una solicitud ANCLA un incidente (la mesa nunca pierde el
-- control): el caso trackea SLA/comunicacion, y service_request guarda el item + form_data.
-- Multi-tenant + RLS + auditado. Numeracion SR-.

-- ---- 1. Catalogo (item solicitable) ----
create table if not exists public.service_item (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenant(id) on delete cascade,
  code                  varchar(60) not null,
  name                  varchar(160) not null,
  description           text,
  category              varchar(80) not null default 'general',
  service_id            uuid references public.service(id) on delete set null,
  delivery_area_id      uuid references public.delivery_area(id) on delete set null,
  workflow_definition_id uuid references public.workflow_definition(id) on delete set null,
  form_schema           jsonb not null default '[]'::jsonb,
  sla_hours             integer not null default 24 check (sla_hours > 0 and sla_hours <= 8760),
  default_impact        impact_level not null default 'low',
  default_urgency       urgency_level not null default 'medium',
  status                record_status not null default 'active',
  created_at            timestamptz not null default now(),
  created_by            uuid,
  updated_at            timestamptz not null default now(),
  updated_by            uuid,
  constraint uq_service_item_code unique (tenant_id, code)
);
create index if not exists idx_service_item_tenant on public.service_item (tenant_id, status, category);

-- ---- 2. Solicitud (anclada a un incidente) ----
create table if not exists public.service_request (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenant(id) on delete cascade,
  request_number       varchar(40) not null,
  item_id              uuid not null references public.service_item(id) on delete restrict,
  incident_id          uuid not null references public.incident(id) on delete cascade,
  requested_by_user_id uuid references public.user_account(id) on delete set null,
  form_data            jsonb not null default '{}'::jsonb,
  status               varchar(12) not null default 'open' check (status in ('open','fulfilled','cancelled')),
  sla_due_at           timestamptz,
  workflow_instance_id uuid references public.workflow_instance(id) on delete set null,
  fulfilled_at         timestamptz,
  created_at           timestamptz not null default now(),
  created_by           uuid,
  updated_at           timestamptz not null default now(),
  updated_by           uuid,
  constraint uq_service_request_incident unique (incident_id),
  constraint uq_service_request_number unique (tenant_id, request_number)
);
create index if not exists idx_service_request_tenant on public.service_request (tenant_id, status);
create index if not exists idx_service_request_item on public.service_request (item_id);

-- ---- numeracion SR ----
create or replace function public.set_service_request_number() returns trigger language plpgsql set search_path = public as $$
begin
  if new.request_number is null or new.request_number = '' then
    new.request_number := public.next_document_number(new.tenant_id, 'service_request', 'SR');
  end if;
  return new;
end $$;
drop trigger if exists trg_service_request_number on public.service_request;
create trigger trg_service_request_number before insert on public.service_request for each row execute function public.set_service_request_number();

-- ---- updated_at + audit ----
drop trigger if exists trg_service_item_updated on public.service_item;
create trigger trg_service_item_updated before update on public.service_item for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_service_item on public.service_item;
create trigger trg_audit_service_item after insert or update or delete on public.service_item for each row execute function public.audit_row_change();
drop trigger if exists trg_service_request_updated on public.service_request;
create trigger trg_service_request_updated before update on public.service_request for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_service_request on public.service_request;
create trigger trg_audit_service_request after insert or update or delete on public.service_request for each row execute function public.audit_row_change();

-- ---- RLS ----
alter table public.service_item enable row level security;
drop policy if exists service_item_isolation on public.service_item;
create policy service_item_isolation on public.service_item for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
alter table public.service_request enable row level security;
drop policy if exists service_request_isolation on public.service_request;
create policy service_request_isolation on public.service_request for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- ---- permisos ----
insert into public.permission (code, resource, action, description) values
  ('service_catalog.read',    'service_catalog', 'read',    'Ver el catalogo de servicios y solicitudes'),
  ('service_catalog.request', 'service_catalog', 'request', 'Solicitar un servicio del catalogo'),
  ('service_catalog.manage',  'service_catalog', 'manage',  'Administrar items del catalogo')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id from public.permission p join public.role r on (
     (p.code='service_catalog.read'    and r.code in ('support_agent','support_lead','change_manager','grc_officer','product_owner','business_owner','people_lead','partner_user','auditor','system_admin','tenant_admin'))
  or (p.code='service_catalog.request' and r.code in ('support_agent','support_lead','change_manager','grc_officer','product_owner','business_owner','people_lead','partner_user','system_admin','tenant_admin'))
  or (p.code='service_catalog.manage'  and r.code in ('support_lead','change_manager','system_admin','tenant_admin'))
)
where p.code in ('service_catalog.read','service_catalog.request','service_catalog.manage')
on conflict do nothing;

-- ---- seed: items solicitables realistas (contexto interno Credix) ----
insert into public.service_item (tenant_id, code, name, description, category, delivery_area_id, form_schema, sla_hours, default_impact, default_urgency)
select t.id, v.code, v.name, v.descr, v.cat,
       (select id from public.delivery_area d where d.tenant_id=t.id and d.code='operations' limit 1),
       v.schema::jsonb, v.sla, v.impact::impact_level, v.urgency::urgency_level
from public.tenant t
cross join (values
  ('SR_VPN_ACCESS', 'Acceso a VPN', 'Solicitud de acceso a la VPN corporativa para un sistema.', 'acceso',
    '[{"key":"sistema","label":"Sistema","type":"text","required":true},{"key":"justificacion","label":"Justificacion","type":"textarea","required":true}]', 8, 'low', 'high'),
  ('SR_USER_ONBOARDING', 'Alta de colaborador', 'Crear accesos y cuentas para un nuevo colaborador.', 'acceso',
    '[{"key":"nombre","label":"Nombre completo","type":"text","required":true},{"key":"area","label":"Area","type":"text","required":true},{"key":"fecha_ingreso","label":"Fecha de ingreso","type":"date","required":true}]', 24, 'medium', 'medium'),
  ('SR_DATA_REPORT', 'Solicitud de reporte de datos', 'Pedir un reporte de datos a analitica.', 'datos',
    '[{"key":"reporte","label":"Reporte","type":"select","required":true,"options":["Cartera","Pagos","Riesgo","Cobranza"]},{"key":"periodo","label":"Periodo","type":"text","required":true},{"key":"notas","label":"Notas","type":"textarea","required":false}]', 48, 'low', 'low'),
  ('SR_PASSWORD_RESET', 'Restablecer contrasena', 'Restablecer la contrasena de un sistema interno.', 'acceso',
    '[{"key":"sistema","label":"Sistema","type":"text","required":true}]', 4, 'low', 'high')
) as v(code, name, descr, cat, schema, sla, impact, urgency)
on conflict (tenant_id, code) do nothing;
