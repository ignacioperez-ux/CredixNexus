-- 0128_recurrence_analytics.sql
-- Analitica de reincidencia para la Gerencia de Operaciones: tasa de reincidencia, efectividad de
-- los fixes por operador (fixes que reaparecieron) y reincidencia por categoria (senal de mejora
-- mayor). SECURITY DEFINER acotado por tenant (current_tenant_id). Metrica aproximada: "came_back"
-- cuenta casos reincidentes cuyo caso previo resolvio ese operador; "resolved" cuenta lo resuelto
-- en la ventana. Idempotente.

create or replace function public.recurrence_analytics(p_days integer default 90)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_from timestamptz := now() - (p_days || ' days')::interval;
  v_result jsonb;
begin
  if v_tenant is null then
    return jsonb_build_object('window_days', p_days, 'total', 0, 'recurrences', 0, 'rate_pct', 0,
                              'by_operator', '[]'::jsonb, 'by_category', '[]'::jsonb);
  end if;

  with new_cases as (
    select * from incident where tenant_id = v_tenant and opened_at >= v_from
  ),
  totals as (
    select count(*)::int as total, count(*) filter (where is_recurrence)::int as recurrences from new_cases
  ),
  op_backs as (
    select prev.assigned_member_id as member_id, count(*)::int as came_back
    from new_cases nc
    join incident prev on prev.id = nc.recurrence_of_incident_id and prev.tenant_id = v_tenant
    where nc.is_recurrence and prev.assigned_member_id is not null
    group by prev.assigned_member_id
  ),
  op_resolved as (
    select assigned_member_id as member_id, count(*)::int as resolved
    from incident
    where tenant_id = v_tenant and assigned_member_id is not null
      and status in ('resolved','closed') and coalesce(resolved_at, opened_at) >= v_from
    group by assigned_member_id
  ),
  by_operator as (
    select coalesce(b.member_id, r.member_id) as member_id,
           coalesce(r.resolved, 0) as resolved, coalesce(b.came_back, 0) as came_back
    from op_backs b full join op_resolved r on r.member_id = b.member_id
    where coalesce(b.came_back, 0) > 0
  ),
  by_cat as (
    select coalesce(nc.category, '—') as category, count(*)::int as recurrences
    from new_cases nc where nc.is_recurrence group by nc.category order by count(*) desc limit 10
  )
  select jsonb_build_object(
    'window_days', p_days,
    'total', (select total from totals),
    'recurrences', (select recurrences from totals),
    'rate_pct', case when (select total from totals) > 0
                     then round((select recurrences from totals)::numeric * 100 / (select total from totals), 1) else 0 end,
    'by_operator', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', coalesce(tm.name, '—'), 'resolved', o.resolved, 'came_back', o.came_back,
        'effectiveness_pct', case when o.resolved > 0
             then greatest(0, round((o.resolved - o.came_back)::numeric * 100 / o.resolved, 1)) else null end
      ) order by o.came_back desc)
      from by_operator o left join team_member tm on tm.id = o.member_id), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'recurrences', recurrences)) from by_cat), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
