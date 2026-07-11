-- 0067_supervisor_metrics.sql
-- Dashboard de Supervisor (Command Center): control de backlog, aging, carga por agente,
-- vencidos, reaperturas, tareas vencidas y cuellos de botella. Read-only, SECURITY INVOKER,
-- RLS via current_tenant_id(). Todo derivado de datos reales (incident, case_task, team_member).

create or replace function public.supervisor_metrics()
returns jsonb language plpgsql stable set search_path = public as $$
declare v_tenant uuid := public.current_tenant_id(); r jsonb;
begin
  if v_tenant is null then return '{}'::jsonb; end if;

  select jsonb_build_object(
    'open',       (select count(*) from incident where tenant_id=v_tenant and status not in ('resolved','closed','cancelled')),
    'unassigned', (select count(*) from incident where tenant_id=v_tenant and status not in ('resolved','closed','cancelled') and assigned_member_id is null and assigned_user_id is null),
    'overdue',    (select count(*) from incident where tenant_id=v_tenant and status not in ('resolved','closed','cancelled') and sla_resolution_due_at is not null and sla_resolution_due_at < now()),
    'waiting',    (select count(*) from incident where tenant_id=v_tenant and status = 'waiting'),
    'reopened',   (select count(*) from incident where tenant_id=v_tenant and status = 'reopened'),

    'aging', coalesce((select jsonb_agg(jsonb_build_object('bucket', b.bucket, 'count', x.c) order by b.ord) from
        (values ('0-1d',1),('1-3d',2),('3-7d',3),('7d+',4)) b(bucket, ord)
        left join lateral (
          select count(*) c from incident i
          where i.tenant_id=v_tenant and i.status not in ('resolved','closed','cancelled')
            and case
              when now()-i.opened_at < interval '1 day'  then '0-1d'
              when now()-i.opened_at < interval '3 days' then '1-3d'
              when now()-i.opened_at < interval '7 days' then '3-7d'
              else '7d+' end = b.bucket
        ) x on true), '[]'::jsonb),

    'by_status', coalesce((select jsonb_object_agg(status, c) from
        (select status::text, count(*) c from incident where tenant_id=v_tenant and status not in ('resolved','closed','cancelled') group by status) s), '{}'::jsonb),

    'tasks', jsonb_build_object(
      'open',    (select count(*) from case_task where tenant_id=v_tenant and status='open'),
      'overdue', (select count(*) from case_task where tenant_id=v_tenant and status='open' and due_date is not null and due_date < current_date)
    ),

    'workload', coalesce((select jsonb_agg(jsonb_build_object(
        'agent', tm.name,
        'open',    (select count(*) from incident i where i.assigned_member_id=tm.id and i.status not in ('resolved','closed','cancelled')),
        'overdue', (select count(*) from incident i where i.assigned_member_id=tm.id and i.status not in ('resolved','closed','cancelled') and i.sla_resolution_due_at is not null and i.sla_resolution_due_at < now())
      ) order by (select count(*) from incident i where i.assigned_member_id=tm.id and i.status not in ('resolved','closed','cancelled')) desc)
      from team_member tm where tm.tenant_id=v_tenant and tm.status='active'
        and exists (select 1 from incident i where i.assigned_member_id=tm.id and i.status not in ('resolved','closed','cancelled'))), '[]'::jsonb),

    'quality', jsonb_build_object(
      'resolved_30d', (select count(*) from incident where tenant_id=v_tenant and resolved_at >= now()-interval '30 days'),
      'reopened',     (select count(*) from incident where tenant_id=v_tenant and status='reopened'),
      'reopen_rate',  (select case when count(*) filter (where resolved_at >= now()-interval '30 days') = 0 then 0
                         else round(100.0 * count(*) filter (where status='reopened') / count(*) filter (where resolved_at >= now()-interval '30 days')) end
                       from incident where tenant_id=v_tenant)
    )
  ) into r;
  return r;
end $$;
