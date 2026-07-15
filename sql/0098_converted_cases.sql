-- 0098 — Vista "Casos convertidos" (trazabilidad incidencia -> mejora/proyecto).
-- Lista los casos que entraron al pipeline de Evolucion (candidatos/derivados/con recomendacion
-- o proyecto) con TODA su informacion dimensional. SECURITY DEFINER + gate project.read + scope
-- tenant: el Gerente de Evolucion (sin incident.read) accede SOLO a estos casos (su dominio), no
-- al universo de casos. Devuelve filas (no agregados) porque son casos ya en evolucion.

create or replace function public.converted_cases()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_tenant uuid := public.current_tenant_id();
  r jsonb;
begin
  if not (public.has_permission('project.read') or public.has_permission('incident.read')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_tenant is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(to_jsonb(row) order by row.opened_at desc nulls last), '[]'::jsonb)
  into r
  from (
    select
      i.id,
      i.incident_number,
      i.title,
      i.status::text as status,
      i.case_type,
      i.priority::text as priority,
      i.opened_at,
      i.resolved_at,
      i.created_at,
      coalesce(ua.full_name, ua.username, ua.email) as reporter,
      round(coalesce(i.transformation_score, 0)::numeric, 0) as transformation_score,
      i.transformation_decision,
      coalesce(i.financial_impact_estimate, 0) as financial_impact,
      coalesce(i.affected_partner_count, 0) as partners,
      pr.name as product,
      sv.name as system,
      pc.name as process,
      bu.name as business_unit,
      ch.name as channel,
      coalesce(ic.name, i.category) as category,
      rec.recommendation_status,
      proj.project_code,
      proj.name as project_name,
      proj.status as project_status,
      case when proj.id is not null then 'project'
           when rec.id is not null then 'improvement'
           else 'candidate' end as converted_to
    from incident i
    left join user_account ua on ua.id = i.reported_by_user_id
    left join product pr on pr.id = i.affected_product_id
    left join service sv on sv.id = i.affected_service_id
    left join process pc on pc.id = i.affected_process_id
    left join business_unit bu on bu.id = i.affected_business_unit_id
    left join channel ch on ch.id = i.affected_channel_id
    left join incident_category ic on ic.id = i.category_id
    left join lateral (
      select pr2.id, pr2.recommendation_status
      from project_recommendation pr2 where pr2.incident_id = i.id
      order by pr2.created_at desc limit 1
    ) rec on true
    left join lateral (
      select p.id, p.project_code, p.name, p.status::text as status
      from project p where p.created_from_incident_id = i.id
      order by p.created_at desc limit 1
    ) proj on true
    where i.tenant_id = v_tenant
      and (
        i.transformation_candidate
        or i.status = 'in_evolution'
        or exists (select 1 from project_recommendation x where x.incident_id = i.id)
        or exists (select 1 from project x where x.created_from_incident_id = i.id)
      )
  ) row;

  return r;
end
$function$;

revoke all on function public.converted_cases() from public;
grant execute on function public.converted_cases() to authenticated;

comment on function public.converted_cases() is
  'Vista Casos convertidos: casos en pipeline de Evolucion con toda su info dimensional. Gate project.read/incident.read + scope tenant.';
