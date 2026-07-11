-- 0046_major_incident.sql
-- Major Incident Command (ITIL 4 / F-Fin4). Un incidente critico (P1) se declara
-- como incidente mayor: war-room con comandante y lider de comunicaciones, timeline
-- de comunicaciones (client-centric: el cliente y stakeholders reciben actualizaciones
-- periodicas) y estados de mando. Multi-tenant + RLS + auditado. Numeracion MI-.

create table if not exists public.major_incident (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenant(id) on delete cascade,
  mi_number           varchar(32) not null,
  incident_id         uuid not null references public.incident(id) on delete restrict,
  title               varchar(200) not null,
  severity            varchar(8) not null default 'sev2' check (severity in ('sev1','sev2','sev3')),
  status              varchar(16) not null default 'declared'
                        check (status in ('declared','investigating','identified','mitigating','monitoring','resolved','stood_down')),
  commander_user_id   uuid references public.user_account(id) on delete set null,
  comms_lead_user_id  uuid references public.user_account(id) on delete set null,
  summary             text,
  impact_summary      text,
  bridge_url          varchar(500),
  next_update_due_at  timestamptz,
  declared_at         timestamptz not null default now(),
  resolved_at         timestamptz,
  stood_down_at       timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  created_by          uuid,
  updated_at          timestamptz not null default now(),
  updated_by          uuid,
  constraint major_incident_number_unique unique (tenant_id, mi_number),
  constraint major_incident_one_per_incident unique (incident_id),
  constraint major_incident_resolved_after check (resolved_at is null or resolved_at >= declared_at),
  constraint major_incident_stood_after check (stood_down_at is null or stood_down_at >= declared_at)
);
create index if not exists idx_mi_tenant_status on public.major_incident (tenant_id, status);
create index if not exists idx_mi_incident on public.major_incident (incident_id);

-- Timeline de comunicaciones del incidente mayor.
create table if not exists public.major_incident_update (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant(id) on delete cascade,
  mi_id          uuid not null references public.major_incident(id) on delete cascade,
  update_type    varchar(16) not null default 'internal'
                   check (update_type in ('internal','customer','stakeholder','status')),
  body           text not null,
  posted_by      uuid,
  posted_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  created_by     uuid
);
create index if not exists idx_mi_update_mi on public.major_incident_update (mi_id, posted_at);

-- Numeracion MI-
create or replace function public.set_mi_number()
returns trigger language plpgsql
set search_path = public as $$
begin
  if new.mi_number is null or new.mi_number = '' then
    new.mi_number := public.next_document_number(new.tenant_id, 'major_incident', 'MI');
  end if;
  return new;
end $$;

drop trigger if exists trg_mi_number on public.major_incident;
create trigger trg_mi_number before insert on public.major_incident for each row execute function public.set_mi_number();
drop trigger if exists trg_mi_updated on public.major_incident;
create trigger trg_mi_updated before update on public.major_incident for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_mi on public.major_incident;
create trigger trg_audit_mi after insert or update or delete on public.major_incident for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_mi_update on public.major_incident_update;
create trigger trg_audit_mi_update after insert or update or delete on public.major_incident_update for each row execute function public.audit_row_change();

alter table public.major_incident enable row level security;
alter table public.major_incident_update enable row level security;
drop policy if exists mi_isolation on public.major_incident;
create policy mi_isolation on public.major_incident using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
drop policy if exists mi_update_isolation on public.major_incident_update;
create policy mi_update_isolation on public.major_incident_update using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

insert into public.permission (code, resource, action, description) values
  ('major_incident.read',   'major_incident', 'read',   'Ver incidentes mayores y su war-room'),
  ('major_incident.manage', 'major_incident', 'manage', 'Declarar y comandar incidentes mayores')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (
     (p.code = 'major_incident.read'   and r.code in ('support_agent','support_lead','auditor','ai_agent','system_admin','tenant_admin','change_manager','responsable_comercial'))
  or (p.code = 'major_incident.manage' and r.code in ('support_lead','change_manager','system_admin','tenant_admin'))
)
where p.code in ('major_incident.read','major_incident.manage')
on conflict do nothing;
