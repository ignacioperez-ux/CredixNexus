-- 0055_case_survey.sql
-- CSAT / XLA: satisfaccion del usuario. Al resolver/cerrar un caso se habilita una
-- encuesta (1-5). Mide experiencia, no solo tiempo. Audit-grade + RLS. Alimenta la
-- analitica (indice CSAT global). Orientado a la satisfaccion del usuario de Credix.

create table if not exists public.case_survey (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  incident_id  uuid not null references public.incident(id) on delete cascade,
  score        smallint check (score is null or (score between 1 and 5)),
  comment      text,
  status       varchar(12) not null default 'pending' check (status in ('pending','submitted','na')),
  sent_at      timestamptz not null default now(),
  submitted_at timestamptz,
  submitted_by uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  constraint case_survey_one_per_incident unique (incident_id),
  constraint case_survey_submitted_needs_score check (status <> 'submitted' or score is not null)
);
create index if not exists idx_case_survey_tenant on public.case_survey (tenant_id, status);

drop trigger if exists trg_case_survey_updated on public.case_survey;
create trigger trg_case_survey_updated before update on public.case_survey for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_case_survey on public.case_survey;
create trigger trg_audit_case_survey after insert or update or delete on public.case_survey for each row execute function public.audit_row_change();

alter table public.case_survey enable row level security;
drop policy if exists case_survey_isolation on public.case_survey;
create policy case_survey_isolation on public.case_survey using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- Al resolver/cerrar un caso se habilita la encuesta (pendiente).
create or replace function public.enqueue_case_survey()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status in ('resolved','closed') and (old.status is distinct from new.status) then
    insert into public.case_survey (tenant_id, incident_id, status)
    values (new.tenant_id, new.id, 'pending')
    on conflict (incident_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_incident_survey on public.incident;
create trigger trg_incident_survey after update on public.incident for each row execute function public.enqueue_case_survey();

insert into public.permission (code, resource, action, description) values
  ('survey.submit', 'survey', 'submit', 'Registrar la satisfaccion (CSAT) de un caso')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (p.code='survey.submit' and r.code in ('support_agent','support_lead','change_manager','system_admin','tenant_admin','partner_user'))
where p.code='survey.submit'
on conflict do nothing;

-- Backfill: encuestas para casos ya resueltos/cerrados + algunas respuestas demo.
insert into public.case_survey (tenant_id, incident_id, status)
select tenant_id, id, 'pending' from public.incident where status in ('resolved','closed')
on conflict (incident_id) do nothing;

update public.case_survey s
   set status='submitted', score=v.score, comment=v.comment, submitted_at=now()
from (
  select id, (4 + (row_number() over ()) % 2)::int as score, 'Buena atencion, resuelto a tiempo.' as comment
  from public.case_survey where status='pending'
) v
where s.id = v.id and s.status='pending' and (v.id::text like '%a%' or v.id::text like '%e%');

-- Indice CSAT global en analytics_overview (se re-crea agregando el bloque csat).
create or replace function public.analytics_overview()
returns jsonb language plpgsql stable set search_path = public as $$
declare v_tenant uuid := public.current_tenant_id(); r jsonb;
begin
  if v_tenant is null then return '{}'::jsonb; end if;
  select jsonb_build_object(
    'incidents', jsonb_build_object(
      'total', (select count(*) from incident where tenant_id = v_tenant),
      'open', (select count(*) from incident where tenant_id = v_tenant and status not in ('resolved','closed','cancelled')),
      'p1_open', (select count(*) from incident where tenant_id = v_tenant and priority = 'p1_critical' and status not in ('resolved','closed','cancelled')),
      'p2_open', (select count(*) from incident where tenant_id = v_tenant and priority = 'p2_high' and status not in ('resolved','closed','cancelled')),
      'p3_open', (select count(*) from incident where tenant_id = v_tenant and priority = 'p3_medium' and status not in ('resolved','closed','cancelled')),
      'p4_open', (select count(*) from incident where tenant_id = v_tenant and priority = 'p4_low' and status not in ('resolved','closed','cancelled')),
      'resolved_30d', (select count(*) from incident where tenant_id = v_tenant and resolved_at >= now() - interval '30 days'),
      'mttr_hours', (select round(coalesce(avg(extract(epoch from (resolved_at - opened_at)) / 3600), 0)::numeric, 1) from incident where tenant_id = v_tenant and resolved_at >= now() - interval '30 days'),
      'sla_breached', (select count(*) from incident where tenant_id = v_tenant and status not in ('resolved','closed','cancelled') and sla_resolution_due_at is not null and sla_resolution_due_at < now()),
      'transformation_candidates', (select count(*) from incident where tenant_id = v_tenant and transformation_candidate),
      'in_evolution', (select count(*) from incident where tenant_id = v_tenant and status = 'in_evolution')
    ),
    'by_status', coalesce((select jsonb_object_agg(status, c) from (select status::text, count(*) c from incident where tenant_id = v_tenant group by status) s), '{}'::jsonb),
    'problems', jsonb_build_object('open', (select count(*) from problem where tenant_id = v_tenant and status in ('new','investigating','known_error')), 'known_errors', (select count(*) from problem where tenant_id = v_tenant and known_error)),
    'changes', jsonb_build_object('open', (select count(*) from change_request where tenant_id = v_tenant and status not in ('closed','rejected','cancelled')), 'pending_cab', (select count(*) from change_request where tenant_id = v_tenant and status = 'pending_cab'), 'scheduled', (select count(*) from change_request where tenant_id = v_tenant and status = 'scheduled'), 'emergency', (select count(*) from change_request where tenant_id = v_tenant and change_type = 'emergency' and status not in ('closed','rejected','cancelled'))),
    'major_incidents', jsonb_build_object('active', (select count(*) from major_incident where tenant_id = v_tenant and status not in ('resolved','stood_down')), 'sev1', (select count(*) from major_incident where tenant_id = v_tenant and severity = 'sev1' and status not in ('resolved','stood_down'))),
    'risk', jsonb_build_object('open', (select count(*) from risk_event where tenant_id = v_tenant and status <> 'closed'), 'estimated', (select coalesce(sum(estimated_loss), 0) from risk_event where tenant_id = v_tenant and status <> 'closed'), 'actual', (select coalesce(sum(actual_loss), 0) from risk_event where tenant_id = v_tenant)),
    'vendors', jsonb_build_object('active', (select count(*) from vendor where tenant_id = v_tenant and status = 'active'), 'critical', (select count(*) from vendor where tenant_id = v_tenant and status = 'active' and criticality = 'critical')),
    'workflows', jsonb_build_object('running', (select count(*) from workflow_instance where tenant_id = v_tenant and status = 'running')),
    'escalations', jsonb_build_object('unack', (select count(*) from escalation_event where tenant_id = v_tenant and acknowledged = false)),
    'csat', jsonb_build_object(
      'responses', (select count(*) from case_survey where tenant_id = v_tenant and status='submitted'),
      'pending', (select count(*) from case_survey where tenant_id = v_tenant and status='pending'),
      'avg', (select round(coalesce(avg(score),0)::numeric,2) from case_survey where tenant_id = v_tenant and status='submitted'),
      'satisfied_pct', (select case when count(*)=0 then 0 else round(100.0*count(*) filter (where score>=4)/count(*)) end from case_survey where tenant_id = v_tenant and status='submitted')
    ),
    'top_categories', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'count', c) order by c desc) from (select coalesce(category, 'general') category, count(*) c from incident where tenant_id = v_tenant and status not in ('resolved','closed','cancelled') group by coalesce(category, 'general') order by c desc limit 6) tc), '[]'::jsonb),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'count', c) order by d) from (select gs::date d, count(i.id) c from generate_series((now() - interval '13 days')::date, now()::date, interval '1 day') gs left join incident i on i.tenant_id = v_tenant and i.opened_at::date = gs::date group by gs::date) t), '[]'::jsonb)
  ) into r;
  return r;
end $$;
