-- 0043_sla_governance.sql
-- Gobierno de niveles de servicio (F-Fin3, corte 1): OLA + escalacion.
-- ITIL 4 / ISO 20000: la mesa nunca incumple en silencio. OLA = meta operativa
-- interna (mas estricta que el SLA con el cliente); las reglas de escalacion
-- disparan avisos/reasignaciones/subida de prioridad ANTES de vencer el SLA.
-- Todo configurable en datos (cero hardcode §11), multi-tenant + RLS + auditado.

-- ============================================================================
-- ola_policy — meta operativa interna por prioridad (y opcionalmente por equipo)
-- ============================================================================
create table if not exists public.ola_policy (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenant(id) on delete cascade,
  priority            priority_level not null,
  assigned_team       varchar(100),               -- null = meta por defecto de la prioridad
  response_minutes    integer not null check (response_minutes > 0),
  resolution_minutes  integer not null check (resolution_minutes > 0),
  status              record_status not null default 'active',
  created_at          timestamptz not null default now(),
  created_by          uuid,
  updated_at          timestamptz not null default now(),
  updated_by          uuid,
  constraint ola_resolution_ge_response check (resolution_minutes >= response_minutes),
  constraint ola_unique unique nulls not distinct (tenant_id, priority, assigned_team)
);
create index if not exists idx_ola_tenant on public.ola_policy (tenant_id, status);

-- ============================================================================
-- escalation_rule — regla configurable de escalacion por umbral de reloj SLA
-- ============================================================================
create table if not exists public.escalation_rule (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant(id) on delete cascade,
  code           varchar(40) not null,
  name           varchar(200) not null,
  sla_type       varchar(12) not null check (sla_type in ('response','resolution')),
  threshold_pct  integer not null check (threshold_pct between 1 and 100),
  priority       priority_level,                  -- null = aplica a todas
  action         varchar(20) not null check (action in ('notify','raise_priority','reassign_team')),
  notify_role    varchar(40),                     -- role.code a avisar (action=notify)
  action_target  varchar(100),                    -- equipo destino (action=reassign_team)
  status         record_status not null default 'active',
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  constraint escalation_rule_code_unique unique (tenant_id, code),
  -- coherencia: notify exige rol; reassign exige equipo destino
  constraint escalation_rule_notify_needs_role check (action <> 'notify' or notify_role is not null),
  constraint escalation_rule_reassign_needs_team check (action <> 'reassign_team' or action_target is not null)
);
create index if not exists idx_escalation_rule_tenant on public.escalation_rule (tenant_id, status);

-- ============================================================================
-- escalation_event — bitacora inmutable de escalaciones disparadas (idempotente)
-- ============================================================================
create table if not exists public.escalation_event (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant(id) on delete cascade,
  incident_id      uuid not null references public.incident(id) on delete cascade,
  rule_id          uuid not null references public.escalation_rule(id) on delete cascade,
  sla_type         varchar(12) not null,
  threshold_pct    integer not null,
  elapsed_pct      integer not null,
  action           varchar(20) not null,
  action_detail    varchar(200),
  acknowledged     boolean not null default false,
  acknowledged_by  uuid,
  acknowledged_at  timestamptz,
  triggered_at     timestamptz not null default now(),
  triggered_by     uuid,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  constraint escalation_event_once unique (incident_id, rule_id)
);
create index if not exists idx_escalation_event_incident on public.escalation_event (incident_id);
create index if not exists idx_escalation_event_open on public.escalation_event (tenant_id, acknowledged);

-- ============================================================================
-- Triggers: updated_at + auditoria (ledger inmutable)
-- ============================================================================
drop trigger if exists trg_ola_updated on public.ola_policy;
create trigger trg_ola_updated before update on public.ola_policy for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_ola on public.ola_policy;
create trigger trg_audit_ola after insert or update or delete on public.ola_policy for each row execute function public.audit_row_change();

drop trigger if exists trg_escalation_rule_updated on public.escalation_rule;
create trigger trg_escalation_rule_updated before update on public.escalation_rule for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_escalation_rule on public.escalation_rule;
create trigger trg_audit_escalation_rule after insert or update or delete on public.escalation_rule for each row execute function public.audit_row_change();

drop trigger if exists trg_escalation_event_updated on public.escalation_event;
create trigger trg_escalation_event_updated before update on public.escalation_event for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_escalation_event on public.escalation_event;
create trigger trg_audit_escalation_event after insert or update or delete on public.escalation_event for each row execute function public.audit_row_change();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.ola_policy enable row level security;
alter table public.escalation_rule enable row level security;
alter table public.escalation_event enable row level security;

drop policy if exists ola_isolation on public.ola_policy;
create policy ola_isolation on public.ola_policy using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
drop policy if exists escalation_rule_isolation on public.escalation_rule;
create policy escalation_rule_isolation on public.escalation_rule using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
drop policy if exists escalation_event_isolation on public.escalation_event;
create policy escalation_event_isolation on public.escalation_event using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- ============================================================================
-- Motor de evaluacion: registra escalaciones cuando se cruzan umbrales.
-- Idempotente (unique incident+rule). Aplica accion y deja evento auditado.
-- SECURITY INVOKER: respeta RLS del tenant y usa auth.uid() como actor.
-- ============================================================================
create or replace function public.evaluate_escalations()
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_actor  uuid := auth.uid();
  v_new    int := 0;
  r        record;
  v_due    timestamptz;
  v_open   boolean;
  v_pct    numeric;
  v_next   priority_level;
begin
  if v_tenant is null then return 0; end if;

  for r in
    select i.id as incident_id, i.priority, i.opened_at, i.first_response_at,
           i.resolved_at, i.sla_response_due_at, i.sla_resolution_due_at,
           er.id as rule_id, er.sla_type, er.threshold_pct, er.action,
           er.action_target, er.notify_role
    from public.incident i
    join public.escalation_rule er
      on er.tenant_id = i.tenant_id
     and er.status = 'active'
     and (er.priority is null or er.priority = i.priority)
    where i.tenant_id = v_tenant
      and i.status not in ('resolved','closed','cancelled')
      and not exists (select 1 from public.escalation_event ee where ee.incident_id = i.id and ee.rule_id = er.id)
  loop
    if r.sla_type = 'response' then
      v_open := r.first_response_at is null and r.sla_response_due_at is not null;
      v_due  := r.sla_response_due_at;
    else
      v_open := r.resolved_at is null and r.sla_resolution_due_at is not null;
      v_due  := r.sla_resolution_due_at;
    end if;

    if not v_open or v_due <= r.opened_at then continue; end if;

    v_pct := 100.0 * extract(epoch from (now() - r.opened_at)) / extract(epoch from (v_due - r.opened_at));
    if v_pct < r.threshold_pct then continue; end if;

    insert into public.escalation_event
      (tenant_id, incident_id, rule_id, sla_type, threshold_pct, elapsed_pct, action, action_detail, triggered_by, created_by)
    values
      (v_tenant, r.incident_id, r.rule_id, r.sla_type, r.threshold_pct, least(round(v_pct),999)::int, r.action,
       case r.action when 'notify' then r.notify_role when 'reassign_team' then r.action_target else null end,
       v_actor, v_actor)
    on conflict (incident_id, rule_id) do nothing;

    if not found then continue; end if;
    v_new := v_new + 1;

    if r.action = 'raise_priority' then
      v_next := case r.priority
                  when 'p4_low' then 'p3_medium'::priority_level
                  when 'p3_medium' then 'p2_high'::priority_level
                  when 'p2_high' then 'p1_critical'::priority_level
                  else null end;
      if v_next is not null then
        update public.incident set priority = v_next, updated_by = v_actor where id = r.incident_id;
      end if;
    elsif r.action = 'reassign_team' and coalesce(r.action_target,'') <> '' then
      update public.incident set assigned_team = r.action_target, updated_by = v_actor where id = r.incident_id;
    end if;
  end loop;

  return v_new;
end $$;

-- ============================================================================
-- Permisos RBAC
-- ============================================================================
insert into public.permission (code, resource, action, description) values
  ('sla.read',   'sla', 'read',   'Ver gobierno de SLA/OLA y escalaciones'),
  ('sla.manage', 'sla', 'manage', 'Configurar OLA, reglas de escalacion y ejecutar evaluacion')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (
     (p.code = 'sla.read'   and r.code in ('support_agent','support_lead','auditor','ai_agent','system_admin','tenant_admin'))
  or (p.code = 'sla.manage' and r.code in ('support_lead','system_admin','tenant_admin'))
)
where p.code in ('sla.read','sla.manage')
on conflict do nothing;

-- ============================================================================
-- Seed de configuracion (datos, editables): OLA (mas estricta que el SLA) +
-- reglas de escalacion 75/90/vencido. Idempotente.
-- ============================================================================
-- OLA por defecto: respuesta 70% y resolucion 80% del SLA de la misma prioridad.
insert into public.ola_policy (tenant_id, priority, response_minutes, resolution_minutes)
select sp.tenant_id, sp.priority,
       greatest(1, round(sp.response_minutes   * 0.70))::int,
       greatest(1, round(sp.resolution_minutes * 0.80))::int
from public.sla_policy sp
where sp.status = 'active'
on conflict do nothing;

insert into public.escalation_rule (tenant_id, code, name, sla_type, threshold_pct, priority, action, notify_role, action_target)
select t.id, v.code, v.name, v.sla_type, v.threshold_pct, null::priority_level, v.action, v.notify_role, v.action_target
from public.tenant t
cross join (values
  ('ESC-RESP-75',  'Aviso 75% del SLA de respuesta',        'response',   75,  'notify',         'support_lead', null),
  ('ESC-RESP-90',  'Aviso 90% del SLA de respuesta',        'response',   90,  'notify',         'support_lead', null),
  ('ESC-RESP-100', 'Respuesta vencida: subir prioridad',    'response',   100, 'raise_priority', null,           null),
  ('ESC-RESO-75',  'Aviso 75% del SLA de resolucion',       'resolution', 75,  'notify',         'support_lead', null),
  ('ESC-RESO-90',  'Aviso 90% del SLA de resolucion',       'resolution', 90,  'notify',         'support_lead', null),
  ('ESC-RESO-100', 'Resolucion vencida: aviso a admin',     'resolution', 100, 'notify',         'system_admin', null)
) as v(code, name, sla_type, threshold_pct, action, notify_role, action_target)
on conflict (tenant_id, code) do nothing;
