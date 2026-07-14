-- 0093 — Fase Evolucion 1.3: RPC de analisis de comportamiento AGREGADO de casos.
-- Objetivo: dar al Gerente de Evolucion (y a analitica) una vista PROACTIVA del comportamiento
-- de casos por dimension de negocio (producto/sistema/area/canal/proceso/categoria/prioridad),
-- con tendencia, proyeccion transparente y senales de causa-raiz. NUNCA devuelve casos
-- individuales: solo agregados. Refuerza la segregacion (product_owner no tiene incident.read).
--
-- Seguridad: SECURITY DEFINER (agrega aun si la RLS de fila se endurece luego) + verificacion
-- explicita de permiso `analytics.read` + scope por current_tenant_id(). Sin SQL dinamico:
-- la dimension se resuelve por whitelist con CASE (no inyectable). Etiquetas descriptivas por
-- join a maestros (§10.3: nombre, no UUID).

create or replace function public.incident_behavior_analysis(
  p_dimension text default 'category',
  p_weeks integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_tenant uuid := public.current_tenant_id();
  v_dim text;
  v_weeks integer := greatest(4, least(coalesce(p_weeks, 12), 52));
  v_from timestamptz;
  r jsonb;
begin
  -- Gate de permiso a nivel de datos (no solo de UI/ruta).
  if not public.has_permission('analytics.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_tenant is null then
    return '{}'::jsonb;
  end if;

  -- Whitelist de dimensiones (evita inyeccion; default seguro).
  v_dim := case lower(coalesce(p_dimension, 'category'))
    when 'product' then 'product'
    when 'service' then 'service'
    when 'business_unit' then 'business_unit'
    when 'channel' then 'channel'
    when 'process' then 'process'
    when 'priority' then 'priority'
    else 'category'
  end;
  v_from := date_trunc('week', now()) - ((v_weeks - 1) || ' weeks')::interval;

  with base as (
    select
      i.id,
      case v_dim
        when 'product' then i.affected_product_id::text
        when 'service' then i.affected_service_id::text
        when 'business_unit' then i.affected_business_unit_id::text
        when 'channel' then i.affected_channel_id::text
        when 'process' then i.affected_process_id::text
        when 'priority' then i.priority::text
        else i.category_id::text
      end as gid,
      case v_dim
        when 'product' then pr.name
        when 'service' then sv.name
        when 'business_unit' then bu.name
        when 'channel' then ch.name
        when 'process' then pc.name
        when 'priority' then i.priority::text
        else coalesce(ic.name, i.category)
      end as glabel,
      (i.status not in ('resolved','closed','cancelled')) as is_open,
      i.resolved_at,
      i.opened_at,
      case when i.resolved_at is not null
           then extract(epoch from (i.resolved_at - i.opened_at)) / 3600.0 end as ttr_hours,
      (i.status not in ('resolved','closed','cancelled')
         and i.sla_resolution_due_at is not null and i.sla_resolution_due_at < now()) as sla_breached,
      coalesce(i.transformation_candidate, false) as tcand,
      i.transformation_score,
      coalesce(i.financial_impact_estimate, 0) as fin,
      coalesce(i.affected_partner_count, 0) as partners,
      coalesce(i.affected_transaction_count, 0) as txns,
      exists (select 1 from problem_incident pinc where pinc.incident_id = i.id) as has_problem,
      (i.opened_at >= (now() - ((v_weeks / 2.0) || ' weeks')::interval)) as recent_half
    from incident i
    left join product pr on pr.id = i.affected_product_id
    left join service sv on sv.id = i.affected_service_id
    left join business_unit bu on bu.id = i.affected_business_unit_id
    left join channel ch on ch.id = i.affected_channel_id
    left join process pc on pc.id = i.affected_process_id
    left join incident_category ic on ic.id = i.category_id
    where i.tenant_id = v_tenant
      and i.opened_at >= v_from
  ),
  grouped as (
    select
      coalesce(gid, 'unassigned') as key,
      coalesce(nullif(btrim(glabel), ''), 'Sin asignar') as label,
      count(*)::int as total,
      count(*) filter (where is_open)::int as open,
      count(*) filter (where resolved_at is not null)::int as resolved,
      round(coalesce(avg(ttr_hours), 0)::numeric, 1) as mttr_hours,
      count(*) filter (where sla_breached)::int as sla_breached,
      count(*) filter (where tcand)::int as transformation_candidates,
      round(coalesce(avg(transformation_score), 0)::numeric, 2) as avg_transformation_score,
      round(coalesce(sum(fin), 0)::numeric, 2) as financial_impact,
      coalesce(sum(partners), 0)::int as partners,
      coalesce(sum(txns), 0)::int as transactions,
      count(*) filter (where has_problem)::int as with_problem,
      (count(*) filter (where recent_half) - count(*) filter (where not recent_half))::int as momentum
    from base
    group by 1, 2
  ),
  trend as (
    select to_char(w, 'YYYY-MM-DD') as week, count(b.id)::int as count
    from generate_series(v_from, date_trunc('week', now()), interval '1 week') w
    left join base b on date_trunc('week', b.opened_at) = w
    group by w order by w
  ),
  trend_idx as (
    select week, count, row_number() over (order by week) as x from trend
  ),
  proj as (
    select
      regr_slope(count, x) as slope,
      regr_intercept(count, x) as intercept,
      count(*) as n
    from trend_idx
  )
  select jsonb_build_object(
    'dimension', v_dim,
    'window_weeks', v_weeks,
    'total_incidents', (select count(*) from base),
    'open_incidents', (select count(*) filter (where is_open) from base),
    'groups_total', (select count(*) from grouped),
    'groups', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.total desc, g.label)
      from (select * from grouped order by total desc, label limit 15) g
    ), '[]'::jsonb),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('week', week, 'count', count) order by week) from trend), '[]'::jsonb),
    'projection', (
      select case when p.slope is null then null else jsonb_build_object(
        'method', 'linear',
        'slope', round(p.slope::numeric, 2),
        'next_week', greatest(0, round((p.intercept + p.slope * (p.n + 1))::numeric, 0))
      ) end from proj p
    ),
    -- Senal de causa-raiz: volumen relevante + momentum al alza + fuerte senal de transformacion
    -- + SIN problema vinculado (nadie ha abierto causa-raiz todavia). Explicable, no "AI theater".
    'signals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', key, 'label', label, 'total', total, 'momentum', momentum,
        'avg_transformation_score', avg_transformation_score,
        'transformation_candidates', transformation_candidates, 'with_problem', with_problem,
        'reason', 'volumen al alza y candidatos a transformacion sin problema vinculado'
      ) order by momentum desc, total desc)
      from grouped
      where key <> 'unassigned' and total >= 3 and momentum > 0 and with_problem = 0
        and (transformation_candidates > 0 or avg_transformation_score >= 0.5)
      limit 8
    ), '[]'::jsonb)
  ) into r;

  return r;
end
$function$;

revoke all on function public.incident_behavior_analysis(text, integer) from public;
grant execute on function public.incident_behavior_analysis(text, integer) to authenticated;

comment on function public.incident_behavior_analysis(text, integer) is
  'Fase Evolucion 1.3: analisis AGREGADO de comportamiento de casos por dimension (nunca casos individuales). Gate analytics.read + scope current_tenant_id.';
