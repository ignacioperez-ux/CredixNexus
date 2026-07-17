-- FASE 6 · Ajustes de completitud detectados en verificacion
-- 1) Juan Pacheco a >=35 project_tasks (todos los estados)
-- 2) incident_assignee: espejo del asignado principal (evita tabla vacia; alimenta Torre multi-asignado)
-- 3) governance_link: enlaza los 4 governance_items a entidades reales (evita tabla vacia)
do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128'; juan uuid;
begin
 select tm.id into juan from team_member tm join user_account u on u.id=tm.user_id where u.email='squads@credix.local';
 insert into project_task (tenant_id, project_id, title, description, owner_user_id, status, priority, effort_points, assigned_member_id, completed_at, created_at)
 select T, p.id, 'Tarea adicional de Juan '||p.rn, 'Actividad de proyecto asignada a Juan Pacheco.', p.owner_user_id,
   (array['todo','doing','blocked','done'])[1+(p.rn%4)], 'p3_medium', 3, juan,
   (case when p.rn%4=3 then p.created_at - interval '3 days' end), p.created_at
 from (select id, owner_user_id, created_at, row_number() over (order by md5(id::text)) rn from project where tenant_id=T limit 8) p;

 insert into incident_assignee (tenant_id, incident_id, member_id)
 select T, id, assigned_member_id from incident where tenant_id=T and assigned_member_id is not null;

 insert into governance_link (tenant_id, governance_item_id, entity_type, entity_id)
 select T, gi.id, 'project', p.id from governance_item gi cross join lateral (select id from project where tenant_id=T order by md5(gi.id::text||'p') limit 3) p where gi.code='POL_TRANSFORM' and gi.tenant_id=T;
 insert into governance_link (tenant_id, governance_item_id, entity_type, entity_id)
 select T, gi.id, 'incident', i.id from governance_item gi cross join lateral (select id from incident where tenant_id=T and status='in_evolution' order by md5(gi.id::text||'i') limit 3) i where gi.code='NRM_AUDIT_GRADE' and gi.tenant_id=T;
 insert into governance_link (tenant_id, governance_item_id, entity_type, entity_id)
 select T, gi.id, 'change_request', c.id from governance_item gi cross join lateral (select id from change_request where tenant_id=T order by md5(gi.id::text||'c') limit 3) c where gi.code='CTL_BUSINESS_DECISION' and gi.tenant_id=T;
 insert into governance_link (tenant_id, governance_item_id, entity_type, entity_id)
 select T, gi.id, 'project_recommendation', pr.id from governance_item gi cross join lateral (select id from project_recommendation where tenant_id=T order by md5(gi.id::text||'r') limit 3) pr where gi.code='PRC_EVOLUTION_INTAKE' and gi.tenant_id=T;
end $$;
