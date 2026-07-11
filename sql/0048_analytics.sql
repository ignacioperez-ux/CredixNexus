-- 0048_analytics.sql
-- Capa analitica (F-Fin5). Funcion de solo lectura que agrega metricas cruzadas de
-- todos los modulos (incidentes, problemas, cambios, incidentes mayores, riesgo, SLA,
-- proveedores, workflows) para el dashboard ejecutivo. SECURITY INVOKER: respeta RLS;
-- ademas filtra explicitamente por current_tenant_id() (defensa en profundidad §3.1 #7).

create or replace function public.analytics_overview()
returns jsonb
language plpgsql
stable
set search_path = public
as $$
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
      'mttr_hours', (select round(coalesce(avg(extract(epoch from (resolved_at - opened_at)) / 3600), 0)::numeric, 1)
                       from incident where tenant_id = v_tenant and resolved_at >= now() - interval '30 days'),
      'sla_breached', (select count(*) from incident where tenant_id = v_tenant and status not in ('resolved','closed','cancelled')
                         and sla_resolution_due_at is not null and sla_resolution_due_at < now()),
      'transformation_candidates', (select count(*) from incident where tenant_id = v_tenant and transformation_candidate),
      'in_evolution', (select count(*) from incident where tenant_id = v_tenant and status = 'in_evolution')
    ),
    'by_status', coalesce((select jsonb_object_agg(status, c) from (select status::text, count(*) c from incident where tenant_id = v_tenant group by status) s), '{}'::jsonb),
    'problems', jsonb_build_object(
      'open', (select count(*) from problem where tenant_id = v_tenant and status in ('new','investigating','known_error')),
      'known_errors', (select count(*) from problem where tenant_id = v_tenant and known_error)
    ),
    'changes', jsonb_build_object(
      'open', (select count(*) from change_request where tenant_id = v_tenant and status not in ('closed','rejected','cancelled')),
      'pending_cab', (select count(*) from change_request where tenant_id = v_tenant and status = 'pending_cab'),
      'scheduled', (select count(*) from change_request where tenant_id = v_tenant and status = 'scheduled'),
      'emergency', (select count(*) from change_request where tenant_id = v_tenant and change_type = 'emergency' and status not in ('closed','rejected','cancelled'))
    ),
    'major_incidents', jsonb_build_object(
      'active', (select count(*) from major_incident where tenant_id = v_tenant and status not in ('resolved','stood_down')),
      'sev1', (select count(*) from major_incident where tenant_id = v_tenant and severity = 'sev1' and status not in ('resolved','stood_down'))
    ),
    'risk', jsonb_build_object(
      'open', (select count(*) from risk_event where tenant_id = v_tenant and status <> 'closed'),
      'estimated', (select coalesce(sum(estimated_loss), 0) from risk_event where tenant_id = v_tenant and status <> 'closed'),
      'actual', (select coalesce(sum(actual_loss), 0) from risk_event where tenant_id = v_tenant)
    ),
    'vendors', jsonb_build_object(
      'active', (select count(*) from vendor where tenant_id = v_tenant and status = 'active'),
      'critical', (select count(*) from vendor where tenant_id = v_tenant and status = 'active' and criticality = 'critical')
    ),
    'workflows', jsonb_build_object(
      'running', (select count(*) from workflow_instance where tenant_id = v_tenant and status = 'running')
    ),
    'escalations', jsonb_build_object(
      'unack', (select count(*) from escalation_event where tenant_id = v_tenant and acknowledged = false)
    ),
    'top_categories', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'count', c) order by c desc)
      from (select coalesce(category, 'general') category, count(*) c from incident where tenant_id = v_tenant
            and status not in ('resolved','closed','cancelled') group by coalesce(category, 'general') order by c desc limit 6) tc), '[]'::jsonb),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'count', c) order by d)
      from (select gs::date d, count(i.id) c
            from generate_series((now() - interval '13 days')::date, now()::date, interval '1 day') gs
            left join incident i on i.tenant_id = v_tenant and i.opened_at::date = gs::date
            group by gs::date) t), '[]'::jsonb)
  ) into r;

  return r;
end $$;
