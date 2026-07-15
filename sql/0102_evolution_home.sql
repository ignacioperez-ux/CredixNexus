-- 0102 — Home de Evolucion: agregados del cockpit del rol (funnel + salud de iniciativas).
-- SECURITY DEFINER + gate project.read + scope tenant: solo conteos (nunca casos individuales),
-- para no depender de incident.read. Complementa listPortfolio/tribeLoads (ROI/capacidad).

create or replace function public.evolution_home()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_tenant uuid := public.current_tenant_id();
  r jsonb;
  v_open constant text[] := array['proposed','approved','on_hold','active'];
begin
  if not public.has_permission('project.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_tenant is null then return '{}'::jsonb; end if;

  select jsonb_build_object(
    'funnel', jsonb_build_object(
      'candidates', (select count(*) from incident where tenant_id = v_tenant and transformation_candidate),
      'rec_pending', (select count(*) from project_recommendation where tenant_id = v_tenant and recommendation_status in ('pending','deferred')),
      'rec_approved', (select count(*) from project_recommendation where tenant_id = v_tenant and recommendation_status = 'approved' and created_project_id is null),
      'in_evolution', (select count(*) from incident where tenant_id = v_tenant and status = 'in_evolution'),
      'proj_active', (select count(*) from project where tenant_id = v_tenant and status = 'active'),
      'proj_done', (select count(*) from project where tenant_id = v_tenant and status = 'completed')
    ),
    'health', (
      with pr as (
        select project_id,
          bool_or(kind = 'blocker' or severity = 'critical') as blocked,
          bool_or(severity = 'high' or kind = 'dependency') as at_risk
        from project_risk
        where tenant_id = v_tenant and status <> 'resolved'
        group by project_id
      ),
      op as (select id from project where tenant_id = v_tenant and status = any(v_open))
      select jsonb_build_object(
        'blocked', (select count(*) from pr join op on op.id = pr.project_id where pr.blocked),
        'at_risk', (select count(*) from pr join op on op.id = pr.project_id where pr.at_risk and not pr.blocked),
        'open_projects', (select count(*) from op)
      )
    ),
    'signals', (select count(*) from (
      select 1 from incident i
      where i.tenant_id = v_tenant and i.transformation_candidate
        and coalesce(i.transformation_score,0) >= 50
        and not exists (select 1 from project_recommendation pr where pr.incident_id = i.id)
    ) s)
  ) into r;

  return r;
end
$function$;

revoke all on function public.evolution_home() from public;
grant execute on function public.evolution_home() to authenticated;

comment on function public.evolution_home() is 'Home de Evolucion: funnel + salud de iniciativas + senales (agregado, gate project.read).';
