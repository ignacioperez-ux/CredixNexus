-- 0054_performance.sql
-- F5: Medicion. Registro de esfuerzo por caso (case_work_log) y funcion de metricas
-- de tiempo y calidad por persona / squad / area de entrega. Read-only + RLS.

create table if not exists public.case_work_log (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  incident_id  uuid not null references public.incident(id) on delete cascade,
  member_id    uuid references public.team_member(id) on delete set null,
  minutes      integer not null check (minutes > 0 and minutes <= 100000),
  note         text,
  logged_by    uuid,
  logged_at    timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists idx_case_work_log_incident on public.case_work_log (incident_id);
create index if not exists idx_case_work_log_member on public.case_work_log (member_id);

drop trigger if exists trg_audit_case_work_log on public.case_work_log;
create trigger trg_audit_case_work_log after insert or update or delete on public.case_work_log for each row execute function public.audit_row_change();

alter table public.case_work_log enable row level security;
drop policy if exists case_work_log_isolation on public.case_work_log;
create policy case_work_log_isolation on public.case_work_log using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- Metricas agregadas de rendimiento (por area, squad y persona). SECURITY INVOKER.
create or replace function public.performance_metrics()
returns jsonb language plpgsql stable set search_path = public as $$
declare v_tenant uuid := public.current_tenant_id(); r jsonb;
begin
  if v_tenant is null then return '{}'::jsonb; end if;

  select jsonb_build_object(
    'by_area', coalesce((select jsonb_agg(jsonb_build_object(
        'code', d.code, 'name', d.name,
        'open_incidents', (select count(*) from incident i where i.delivery_area_id=d.id and i.status not in ('resolved','closed','cancelled')),
        'resolved_30d', (select count(*) from incident i where i.delivery_area_id=d.id and i.resolved_at >= now()-interval '30 days'),
        'mttr_hours', (select round(coalesce(avg(extract(epoch from (i.resolved_at-i.opened_at))/3600),0)::numeric,1) from incident i where i.delivery_area_id=d.id and i.resolved_at >= now()-interval '90 days'),
        'sla_breached', (select count(*) from incident i where i.delivery_area_id=d.id and i.status not in ('resolved','closed','cancelled') and i.sla_resolution_due_at is not null and i.sla_resolution_due_at < now()),
        'projects_active', (select count(*) from project p where p.delivery_area_id=d.id and p.status not in ('completed','cancelled')),
        'qa_authorized', (select count(*) from project p where p.delivery_area_id=d.id and p.prod_authorized_at is not null)
      ) order by d.code) from delivery_area d where d.tenant_id=v_tenant and d.status='active'), '[]'::jsonb),

    'by_squad', coalesce((select jsonb_agg(jsonb_build_object(
        'name', sq.name,
        'members', (select count(*) from squad_member sm where sm.squad_id=sq.id and sm.status='active'),
        'allocation_pct', (select coalesce(sum(sm.allocation_pct),0) from squad_member sm where sm.squad_id=sq.id and sm.status='active'),
        'projects', (select count(*) from project p where p.squad_id=sq.id),
        'qa_passed', (select count(*) from project p where p.squad_id=sq.id and p.qa_status='passed'),
        'qa_authorized', (select count(*) from project p where p.squad_id=sq.id and p.prod_authorized_at is not null)
      ) order by sq.name) from squad sq where sq.tenant_id=v_tenant and sq.status='active'), '[]'::jsonb),

    'by_person', coalesce((select jsonb_agg(jsonb_build_object(
        'name', tm.name, 'is_external', tm.is_external, 'discipline', tm.discipline,
        'assigned_open', (select count(*) from incident i where i.assigned_member_id=tm.id and i.status not in ('resolved','closed','cancelled')),
        'resolved_total', (select count(*) from incident i where i.assigned_member_id=tm.id and i.resolved_at is not null),
        'mttr_hours', (select round(coalesce(avg(extract(epoch from (i.resolved_at-i.opened_at))/3600),0)::numeric,1) from incident i where i.assigned_member_id=tm.id and i.resolved_at is not null),
        'reopened', (select count(*) from incident i where i.assigned_member_id=tm.id and i.status='reopened'),
        'effort_minutes', (select coalesce(sum(w.minutes),0) from case_work_log w where w.member_id=tm.id)
      ) order by tm.name) from team_member tm where tm.tenant_id=v_tenant and tm.status='active'), '[]'::jsonb)
  ) into r;
  return r;
end $$;

insert into public.permission (code, resource, action, description) values
  ('worklog.manage', 'worklog', 'manage', 'Registrar esfuerzo (tiempo) en casos')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (p.code='worklog.manage' and r.code in ('support_agent','support_lead','change_manager','system_admin','tenant_admin'))
where p.code='worklog.manage'
on conflict do nothing;
