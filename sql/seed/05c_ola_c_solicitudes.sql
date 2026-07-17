-- FASE 5 · Ola C — 30 solicitudes de servicio: incidente espejo (ServiceRequest) + service_request + workflow_instance + workflow_step
do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128'; tomas uuid; opsarea uuid; acat uuid; wfdef uuid;
begin
 select id into tomas from user_account where email='usuario@credix.local';
 select id into opsarea from delivery_area where code='operations' and tenant_id=T;
 select id into acat from incident_category where code='ACCESS' and tenant_id=T;
 select id into wfdef from workflow_definition where code='WF-SERVICE-REQUEST' and tenant_id=T;
 insert into incident (tenant_id, title, description, category, category_id, case_type, priority, impact, urgency, status, intake_status, classified_as, reported_by_user_id, delivery_area_id, opened_at, created_at, triaged_at, resolved_at, closed_at, resolution_code, resolution_summary, metadata)
 select T, 'Solicitud de servicio '||g||' - '||si.code, 'Solicitud de servicio gestionada via catalogo.', 'ACCESS', acat, 'ServiceRequest',
   'p3_medium','low','medium', st.status, 'accepted','incident',
   (case when g%2=0 then tomas else (select id from user_account where tenant_id=T and party_id is not null order by md5(g::text||'sr') limit 1) end),
   opsarea, tt.ts, tt.ts, tt.ts + interval '2 hours',
   (case when st.status in ('resolved','closed') then tt.ts + interval '2 days' end),
   (case when st.status='closed' then tt.ts + interval '3 days' end),
   (case when st.status in ('resolved','closed') then 'solved' end),
   (case when st.status in ('resolved','closed') then 'Solicitud atendida y cumplida.' end),
   jsonb_build_object('seed','olaC','ord',g,'item',si.code)
 from generate_series(1,30) g
 join lateral (select code from service_item where tenant_id=T order by code offset (g%8) limit 1) si on true
 join lateral (select (array['new','assigned','in_progress','resolved','closed'])[1+(g%5)]::incident_status status) st on true
 cross join lateral (select timestamptz '2026-07-13 10:00-06' - make_interval(days=>g%40, hours=>g%8) ts) tt;
 insert into workflow_instance (tenant_id, definition_id, entity_type, entity_id, title, status, started_by, started_at, completed_at)
 select T, wfdef, 'request', i.id, 'Solicitud '||(i.metadata->>'ord'),
   (case when i.status in ('resolved','closed') then 'completed' else 'running' end), i.reported_by_user_id, i.opened_at,
   (case when i.status in ('resolved','closed') then coalesce(i.closed_at,i.resolved_at) end)
 from incident i where i.metadata->>'seed'='olaC';
 insert into service_request (tenant_id, item_id, incident_id, requested_by_user_id, form_data, status, sla_due_at, workflow_instance_id, fulfilled_at)
 select T, si.id, i.id, i.reported_by_user_id, jsonb_build_object('detalle','Solicitud '||(i.metadata->>'ord'),'item',si.code),
   (case when i.status in ('resolved','closed') then 'fulfilled' when i.status='new' and (i.metadata->>'ord')::int %7=0 then 'cancelled' else 'open' end),
   i.opened_at + make_interval(hours=>si.sla_hours), wi.id,
   (case when i.status in ('resolved','closed') then coalesce(i.closed_at,i.resolved_at) end)
 from incident i join service_item si on si.code=i.metadata->>'item' and si.tenant_id=T
 join workflow_instance wi on wi.entity_id=i.id and wi.entity_type='request' where i.metadata->>'seed'='olaC';
 insert into workflow_step (tenant_id, instance_id, node_id, status, outcome, activated_at, completed_at)
 select T, wi.id, n.id, (case when wi.status='completed' then 'done' when n.sort_order < 2 then 'done' when n.sort_order = 2 then 'active' else 'skipped' end),
   (case when wi.status='completed' or n.sort_order<2 then 'ok' end),
   wi.started_at + make_interval(hours=>n.sort_order), (case when wi.status='completed' or n.sort_order<2 then wi.started_at + make_interval(hours=>n.sort_order+1) end)
 from workflow_instance wi join workflow_node n on n.definition_id=wi.definition_id where wi.entity_type='request' and wi.tenant_id=T;
end $$;
