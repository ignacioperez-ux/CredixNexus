-- 0106 — Torre de Control: bandeja de decisiones + aging del funnel + iniciativas con salud.
-- Todo LECTURA agregada, SECURITY DEFINER gateado por permiso; sin tocar RLS ni exponer casos
-- individuales (los items de decision son entidades ya en el dominio del rol: recomendaciones,
-- cambios, MI, proyectos, borradores KB). La degradacion por permiso ocurre en la funcion.

-- 1) evolution_home: agrega 'aging' (max dias en etapa = edad del mas antiguo) y health.items.
create or replace function public.evolution_home()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_tenant uuid := public.current_tenant_id();
  r jsonb;
  v_open constant text[] := array['proposed','approved','on_hold','active'];
begin
  if not public.has_permission('project.read') then raise exception 'forbidden' using errcode = '42501'; end if;
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
    'aging', jsonb_build_object(
      'candidates', coalesce((select extract(day from now() - min(opened_at))::int from incident where tenant_id = v_tenant and transformation_candidate), 0),
      'rec_pending', coalesce((select extract(day from now() - min(created_at))::int from project_recommendation where tenant_id = v_tenant and recommendation_status in ('pending','deferred')), 0),
      'rec_approved', coalesce((select extract(day from now() - min(coalesce(reviewed_at, created_at)))::int from project_recommendation where tenant_id = v_tenant and recommendation_status = 'approved' and created_project_id is null), 0),
      'in_evolution', coalesce((select extract(day from now() - min(opened_at))::int from incident where tenant_id = v_tenant and status = 'in_evolution'), 0),
      'proj_active', coalesce((select (current_date - min(coalesce(actual_start, created_at::date)))::int from project where tenant_id = v_tenant and status = 'active'), 0),
      'proj_done', coalesce((select (current_date - min(coalesce(actual_end, created_at::date)))::int from project where tenant_id = v_tenant and status = 'completed'), 0)
    ),
    'health', (
      with pr as (
        select project_id, bool_or(kind = 'blocker' or severity = 'critical') as blocked, bool_or(severity = 'high' or kind = 'dependency') as at_risk
        from project_risk where tenant_id = v_tenant and status <> 'resolved' group by project_id
      ), op as (select id, project_code, name from project where tenant_id = v_tenant and status::text = any(v_open))
      select jsonb_build_object(
        'blocked', (select count(*) from pr join op on op.id = pr.project_id where pr.blocked),
        'at_risk', (select count(*) from pr join op on op.id = pr.project_id where pr.at_risk and not pr.blocked),
        'open_projects', (select count(*) from op),
        'items', coalesce((select jsonb_agg(jsonb_build_object('id', op.id, 'code', op.project_code, 'name', op.name, 'kind', case when pr.blocked then 'blocked' else 'at_risk' end) order by pr.blocked desc)
                  from pr join op on op.id = pr.project_id where pr.blocked or pr.at_risk), '[]'::jsonb)
      )
    ),
    'signals', (select count(*) from (
      select 1 from incident i where i.tenant_id = v_tenant and i.transformation_candidate and coalesce(i.transformation_score,0) >= 50
        and not exists (select 1 from project_recommendation pr where pr.incident_id = i.id)
    ) s)
  ) into r;
  return r;
end $function$;

-- 2) evolution_decisions: bandeja priorizada de acciones (agregada, gateada por seccion).
create or replace function public.evolution_decisions()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_tenant uuid := public.current_tenant_id();
  r jsonb := '[]'::jsonb;
  part jsonb;
  v_cnt int;
begin
  if not (public.has_permission('project.read') or public.has_permission('incident.read')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_tenant is null then return '[]'::jsonb; end if;

  -- 1) Incidente mayor con proxima comunicacion vencida (rojo)
  if public.has_permission('major_incident.read') or public.has_permission('major_incident.manage') then
    select coalesce(jsonb_agg(jsonb_build_object('kind','mi_comm','rank',1,'title',mi.title,'code',mi.mi_number,'entity_id',mi.id,
      'age_days', greatest(0, extract(day from now() - mi.next_update_due_at)::int),'severity','red','link','/major-incidents/'||mi.id)), '[]'::jsonb)
    into part from major_incident mi
    where mi.tenant_id = v_tenant and mi.next_update_due_at is not null and mi.next_update_due_at < now() and mi.status::text not in ('resolved','stood_down');
    r := r || part;
  end if;

  -- 2) Cambios esperando CAB
  if public.has_permission('change.approve') then
    select coalesce(jsonb_agg(jsonb_build_object('kind','cab','rank',2,'title',c.title,'code',c.change_number,'entity_id',c.id,
      'age_days', greatest(0, extract(day from now() - coalesce(c.updated_at, c.created_at))::int),
      'severity', case when extract(day from now() - coalesce(c.updated_at, c.created_at))::int = 0 then 'red' else 'amber' end,
      'link','/changes/'||c.id)), '[]'::jsonb)
    into part from change_request c where c.tenant_id = v_tenant and c.status = 'pending_cab';
    r := r || part;
  end if;

  -- 3) Recomendaciones aprobadas sin convertir
  select coalesce(jsonb_agg(jsonb_build_object('kind','convert','rank',3,'title',pr.recommended_name,'code',i.incident_number,'entity_id',pr.id,
    'age_days', greatest(0, extract(day from now() - coalesce(pr.reviewed_at, pr.created_at))::int),
    'severity', case when extract(day from now() - coalesce(pr.reviewed_at, pr.created_at))::int = 0 then 'red' else 'amber' end,
    'link','/projects')), '[]'::jsonb)
  into part from project_recommendation pr left join incident i on i.id = pr.incident_id
  where pr.tenant_id = v_tenant and pr.recommendation_status = 'approved' and pr.created_project_id is null;
  r := r || part;

  -- 4) Senales de causa-raiz sin evaluar (agregado)
  select count(*) into v_cnt from incident i where i.tenant_id = v_tenant and i.transformation_candidate and coalesce(i.transformation_score,0) >= 50
    and not exists (select 1 from project_recommendation pr where pr.incident_id = i.id);
  if v_cnt > 0 then
    r := r || jsonb_build_array(jsonb_build_object('kind','signal','rank',4,'count',v_cnt,'severity','amber','link','/analytics/comportamiento'));
  end if;

  -- 5) Proyectos completados sin ROI real registrado
  select coalesce(jsonb_agg(jsonb_build_object('kind','roi','rank',5,'title',p.name,'code',p.project_code,'entity_id',p.id,
    'age_days', greatest(0, (current_date - coalesce(p.actual_end, p.created_at::date))),'severity','amber','link','/projects/'||p.id)), '[]'::jsonb)
  into part from project p where p.tenant_id = v_tenant and p.status = 'completed' and (p.actual_benefit_amount is null or p.actual_cost_amount is null);
  r := r || part;

  -- 6) Borradores de conocimiento por curar (solo curador)
  if public.has_permission('knowledge.manage') then
    select count(*) into v_cnt from knowledge_article where tenant_id = v_tenant and status = 'draft';
    if v_cnt > 0 then
      r := r || jsonb_build_array(jsonb_build_object('kind','kb','rank',6,'count',v_cnt,'severity','amber','link','/knowledge/revision'));
    end if;
  end if;

  return r;
end $function$;

revoke all on function public.evolution_decisions() from public;
grant execute on function public.evolution_decisions() to authenticated;
comment on function public.evolution_decisions() is 'Torre de Control: bandeja de decisiones agregada y gateada por permiso por seccion.';
