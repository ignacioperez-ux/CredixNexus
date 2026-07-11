-- 0062_csat_dimensions.sql
-- XLA extendido: CSAT por AREA, AGENTE y SERVICIO. Re-crea performance_metrics() agregando
-- (avg, respuestas, % satisfechos) a by_area y by_person, y una nueva dimension by_service.
-- Todo derivado de case_survey unido al incidente (delivery_area_id / assigned_member_id /
-- affected_service_id). Read-only, SECURITY INVOKER, RLS via current_tenant_id().

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
        'qa_authorized', (select count(*) from project p where p.delivery_area_id=d.id and p.prod_authorized_at is not null),
        'csat_avg', (select round(coalesce(avg(s.score),0)::numeric,2) from case_survey s join incident i on i.id=s.incident_id where i.delivery_area_id=d.id and s.status='submitted'),
        'csat_responses', (select count(*) from case_survey s join incident i on i.id=s.incident_id where i.delivery_area_id=d.id and s.status='submitted'),
        'csat_satisfied_pct', (select case when count(*)=0 then 0 else round(100.0*count(*) filter (where s.score>=4)/count(*)) end from case_survey s join incident i on i.id=s.incident_id where i.delivery_area_id=d.id and s.status='submitted')
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
        'effort_minutes', (select coalesce(sum(w.minutes),0) from case_work_log w where w.member_id=tm.id),
        'csat_avg', (select round(coalesce(avg(s.score),0)::numeric,2) from case_survey s join incident i on i.id=s.incident_id where i.assigned_member_id=tm.id and s.status='submitted'),
        'csat_responses', (select count(*) from case_survey s join incident i on i.id=s.incident_id where i.assigned_member_id=tm.id and s.status='submitted'),
        'csat_satisfied_pct', (select case when count(*)=0 then 0 else round(100.0*count(*) filter (where s.score>=4)/count(*)) end from case_survey s join incident i on i.id=s.incident_id where i.assigned_member_id=tm.id and s.status='submitted')
      ) order by tm.name) from team_member tm where tm.tenant_id=v_tenant and tm.status='active'), '[]'::jsonb),

    'by_service', coalesce((select jsonb_agg(jsonb_build_object(
        'code', sv.code, 'name', sv.name, 'criticality', sv.criticality::text,
        'open_incidents', (select count(*) from incident i where i.affected_service_id=sv.id and i.status not in ('resolved','closed','cancelled')),
        'resolved_30d', (select count(*) from incident i where i.affected_service_id=sv.id and i.resolved_at >= now()-interval '30 days'),
        'mttr_hours', (select round(coalesce(avg(extract(epoch from (i.resolved_at-i.opened_at))/3600),0)::numeric,1) from incident i where i.affected_service_id=sv.id and i.resolved_at >= now()-interval '90 days'),
        'csat_avg', (select round(coalesce(avg(s.score),0)::numeric,2) from case_survey s join incident i on i.id=s.incident_id where i.affected_service_id=sv.id and s.status='submitted'),
        'csat_responses', (select count(*) from case_survey s join incident i on i.id=s.incident_id where i.affected_service_id=sv.id and s.status='submitted'),
        'csat_satisfied_pct', (select case when count(*)=0 then 0 else round(100.0*count(*) filter (where s.score>=4)/count(*)) end from case_survey s join incident i on i.id=s.incident_id where i.affected_service_id=sv.id and s.status='submitted')
      ) order by sv.name) from service sv where sv.tenant_id=v_tenant and sv.status='active'
        and exists (select 1 from incident i where i.affected_service_id=sv.id)), '[]'::jsonb)
  ) into r;
  return r;
end $$;
