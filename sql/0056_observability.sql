-- 0056_observability.sql
-- Observability Center: sensor -> workflow -> action. Alertas de monitoreo y eventos
-- de experiencia digital. Desde una alerta se puede crear o correlacionar un caso.
-- Multi-tenant + RLS + auditado.

create table if not exists public.monitoring_alert (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant(id) on delete cascade,
  source             varchar(30) not null default 'monitor',
  alert_type         varchar(60),
  severity           varchar(10) not null default 'medium' check (severity in ('critical','high','medium','low','info')),
  title              varchar(200) not null,
  description        text,
  affected_system    varchar(120),
  affected_api       varchar(120),
  affected_ci_id     uuid references public.configuration_item(id) on delete set null,
  affected_service_id uuid references public.service(id) on delete set null,
  affected_product_id uuid references public.product(id) on delete set null,
  vendor_id          uuid references public.vendor(id) on delete set null,
  status             varchar(14) not null default 'open' check (status in ('open','acknowledged','correlated','resolved')),
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  occurrence_count   integer not null default 1 check (occurrence_count > 0),
  correlated_case_id uuid references public.incident(id) on delete set null,
  major_incident_id  uuid references public.major_incident(id) on delete set null,
  raw_payload        jsonb not null default '{}'::jsonb,
  acknowledged_by    uuid,
  acknowledged_at    timestamptz,
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);
create index if not exists idx_alert_tenant_status on public.monitoring_alert (tenant_id, status);
create index if not exists idx_alert_severity on public.monitoring_alert (tenant_id, severity);

create table if not exists public.digital_experience_event (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant(id) on delete cascade,
  channel          varchar(16) not null check (channel in ('web','mobile','api','ivr','whatsapp')),
  journey_name     varchar(120),
  step_name        varchar(120),
  user_type        varchar(40),
  device_type      varchar(40),
  app_version      varchar(40),
  status           varchar(10) not null default 'success' check (status in ('success','error','slow')),
  response_time_ms integer,
  error_code       varchar(60),
  error_message    text,
  customer_id      uuid references public.party(id) on delete set null,
  session_id       varchar(80),
  occurred_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists idx_dx_tenant_time on public.digital_experience_event (tenant_id, occurred_at);

drop trigger if exists trg_alert_updated on public.monitoring_alert;
create trigger trg_alert_updated before update on public.monitoring_alert for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_alert on public.monitoring_alert;
create trigger trg_audit_alert after insert or update or delete on public.monitoring_alert for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_dx on public.digital_experience_event;
create trigger trg_audit_dx after insert or update or delete on public.digital_experience_event for each row execute function public.audit_row_change();

alter table public.monitoring_alert enable row level security;
alter table public.digital_experience_event enable row level security;
drop policy if exists alert_isolation on public.monitoring_alert;
create policy alert_isolation on public.monitoring_alert using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
drop policy if exists dx_isolation on public.digital_experience_event;
create policy dx_isolation on public.digital_experience_event using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

insert into public.permission (code, resource, action, description) values
  ('observability.read',   'observability', 'read',   'Ver alertas y experiencia digital'),
  ('observability.manage', 'observability', 'manage', 'Reconocer, correlacionar y crear casos desde alertas')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (
     (p.code='observability.read'   and r.code in ('support_agent','support_lead','change_manager','auditor','ai_agent','system_admin','tenant_admin'))
  or (p.code='observability.manage' and r.code in ('support_agent','support_lead','change_manager','system_admin','tenant_admin'))
)
where p.code in ('observability.read','observability.manage')
on conflict do nothing;

-- Seed de alertas demo (senal fintech real).
insert into public.monitoring_alert (tenant_id, source, alert_type, severity, title, description, affected_system, affected_api, affected_ci_id, affected_service_id, vendor_id, status, occurrence_count, first_seen_at, last_seen_at)
select t.id, v.source, v.atype, v.sev, v.title, v.descr, v.sys, v.api, v.ci::uuid, v.svc::uuid, v.vendor::uuid, v.status, v.occ, now()-v.age, now()
from public.tenant t
cross join (values
  ('apm','latency','high','Latencia alta en API de pagos','p95 > 2500ms sostenido en el endpoint de autorizacion.','payments','payments-api','c9b83289-823e-4be9-a2ee-b540c43cc639','62234b34-a478-48f7-bd32-5c357ed15897',null,'open',14, interval '40 minutes'),
  ('log','error_rate','high','Aumento de errores 500 en flujo de login','Tasa de error 500 > 5% en el login web.','auth',null,null,null,null,'open',31, interval '25 minutes'),
  ('job','batch_failure','medium','Batch de conciliacion fallido','El job nocturno de conciliacion termino con error.','reconciliation',null,'80ee3594-6aac-4023-bb14-ec4d630aaeba','62234b34-a478-48f7-bd32-5c357ed15897',null,'open',1, interval '3 hours'),
  ('uptime','timeout','critical','Timeout con procesador externo','El procesador externo no responde (timeouts en cascada).','payments','processor',null,'62234b34-a478-48f7-bd32-5c357ed15897','28d252cb-03b4-4aa1-9de8-4df83a91c1bd','open',9, interval '15 minutes'),
  ('vendor','degradation','high','Caida parcial de servicio OTP','Degradacion del proveedor de OTP; SMS con demora.','otp','otp-send',null,null,null,'acknowledged',6, interval '1 hour'),
  ('synthetic','error_rate','medium','Errores en app movil version 4.2','Incremento de crashes en la version 4.2 (Android).','mobile',null,null,null,null,'open',22, interval '2 hours')
) as v(source, atype, sev, title, descr, sys, api, ci, svc, vendor, status, occ, age)
on conflict do nothing;

-- Seed de eventos de experiencia digital (journeys).
insert into public.digital_experience_event (tenant_id, channel, journey_name, step_name, user_type, device_type, app_version, status, response_time_ms, error_code, occurred_at)
select t.id, v.channel, v.journey, v.step, v.utype, v.device, v.ver, v.status, v.rt, v.err, now()-v.age
from public.tenant t
cross join (values
  ('mobile','Login','Autenticacion','cliente','Android','4.2','success',420,null, interval '5 minutes'),
  ('mobile','Login','Autenticacion','cliente','Android','4.2','error',0,'AUTH_TIMEOUT', interval '8 minutes'),
  ('web','Pago','Autorizacion','cliente','Desktop','web','slow',3100,null, interval '12 minutes'),
  ('web','Pago','Confirmacion','cliente','Desktop','web','success',780,null, interval '15 minutes'),
  ('mobile','Consulta de saldo','Carga','cliente','iOS','4.1','success',310,null, interval '20 minutes'),
  ('mobile','Pago','Autorizacion','cliente','Android','4.2','error',0,'PROCESSOR_TIMEOUT', interval '18 minutes'),
  ('web','Onboarding','Carga de documentos','originador','Desktop','web','slow',4200,null, interval '35 minutes'),
  ('mobile','Consulta de saldo','Carga','cliente','Android','4.2','success',290,null, interval '40 minutes'),
  ('api','Pago','Autorizacion','sistema','server','api','success',180,null, interval '2 minutes'),
  ('api','Pago','Autorizacion','sistema','server','api','error',0,'HTTP_500', interval '6 minutes')
) as v(channel, journey, step, utype, device, ver, status, rt, err, age)
on conflict do nothing;
