-- FASE 5 · Ola D — Evolucion: rule_evaluation -> project_recommendation -> project -> tareas/squads/riesgos/validaciones + change_request
-- Umbral leido de rule_version (thresholds_json: auto_project=85). Cadena incidente->evaluacion->recomendacion->proyecto->link cerrada.
do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128'; rid uuid; rvid uuid; daniel uuid;
begin
 select id into rid from rule where code='TRANSFORM_CREDIX_001' and tenant_id=T;
 select id into rvid from rule_version where rule_id=rid;
 select id into daniel from user_account where email='evolucion@credix.local';
 insert into rule_evaluation (tenant_id, rule_id, rule_version_id, entity_type, entity_id, evaluation_context, input_json, output_json, score, decision, explanation, evaluated_at)
 select T, rid, rvid, 'incident', i.id, 'incident_created',
   jsonb_build_object('financial_impact', i.financial_impact_estimate, 'critical_service', i.priority::text, 'partner_impact', i.partner_impact, 'frequency', (abs(hashtext(i.id::text))%10)),
   jsonb_build_object('score', i.sc, 'band', (case when i.sc>=85 then 'auto_project' when i.sc>=70 then 'project_review' when i.sc>=40 then 'problem_review' else 'operational' end)),
   i.sc, (case when i.sc>=85 then 'auto_project' when i.sc>=70 then 'project_review' when i.sc>=40 then 'problem_review' else 'operational' end),
   'Score de transformacion calculado por el motor TRANSFORM_CREDIX_001 v1 con explicacion por factor.', i.opened_at + interval '1 day'
 from (select id, opened_at, financial_impact_estimate, priority, partner_impact,
         (case when status='in_evolution' then transformation_score else (40+(abs(hashtext(id::text))%30))::numeric end) sc
       from incident where tenant_id=T and (status='in_evolution' or (status in ('resolved','closed') and metadata->>'seed'='olaA'))
       order by (status='in_evolution') desc, md5(id::text) limit 30) i;
 insert into project_recommendation (tenant_id, incident_id, rule_evaluation_id, recommendation_status, transformation_score, recommended_project_type, recommended_name, recommended_business_case, business_priority, reviewed_by, reviewed_at, review_reason)
 select T, re.entity_id, re.id, x.st, re.score, (array['evolution','improvement','automation'])[1+(re.rn%3)],
   'Iniciativa de evolucion desde incidente '||re.rn,
   jsonb_build_object('benefit',(100000+(re.rn*50000)),'cost',(50000+(re.rn*20000)),'summary','Caso de negocio de la recomendacion de transformacion'),
   1+(re.rn%5), daniel, re.evaluated_at + interval '2 days',
   (case when x.st::text='rejected' then 'No cumple umbral estrategico' when x.st::text='deferred' then 'Diferido al proximo trimestre' end)
 from (select id, entity_id, score, evaluated_at, row_number() over (order by md5(id::text)) rn from rule_evaluation where tenant_id=T and score>=85 limit 18) re
 cross join lateral (select (array['converted','converted','converted','converted','converted','converted','converted','converted','converted','converted','pending','pending','pending','pending','rejected','rejected','deferred','deferred'])[re.rn]::recommendation_status st) x;
end $$;

do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128'; daniel uuid;
begin
 select id into daniel from user_account where email='evolucion@credix.local';
 insert into project (tenant_id, name, description, project_type, source_type, status, sponsor_user_id, owner_user_id, squad_id, lead_squad_id, business_unit_id, product_id, estimated_benefit_amount, estimated_cost_amount, business_case, business_value, time_criticality, risk_reduction, job_size, planned_start, planned_end, actual_start, actual_end, created_from_incident_id, created_from_recommendation_id, created_from_rule_evaluation_id, initiative_type, qa_status)
 select T, r.recommended_name, 'Proyecto de evolucion derivado de incidente critico; ancla de comunicacion viva.', 'evolution','incident',
   v.stt, daniel, sq.po_user_id, sq.id, sq.id,
   (select id from business_unit where tenant_id=T order by md5(r.id::text||'bu') limit 1),
   (select id from product where tenant_id=T order by md5(r.id::text||'p') limit 1),
   (100000+r.rn*80000)::numeric, (50000+r.rn*30000)::numeric,
   jsonb_build_object('summary','Caso de negocio del proyecto de evolucion','roi', round((1.2+(r.rn%5)*0.3)::numeric,2)),
   v.bv, v.tc, v.rr, v.js, date '2026-02-01' + (r.rn*7)::int, date '2026-09-01' + (r.rn*7)::int,
   (case when v.stt::text in ('active','on_hold','completed','cancelled') then date '2026-03-01' + (r.rn*5)::int end),
   (case when v.stt::text='completed' then date '2026-06-15' + r.rn::int end),
   r.incident_id, r.id, r.rule_evaluation_id, 'project',
   (case when v.stt::text='completed' then 'passed' when v.stt::text='active' then 'in_testing' else 'pending' end)
 from (select pr.id, pr.incident_id, pr.rule_evaluation_id, pr.recommended_name, row_number() over (order by md5(pr.id::text)) rn from project_recommendation pr where pr.tenant_id=T and pr.recommendation_status='converted') r
 cross join lateral (select (array['approved','approved','active','active','active','active','on_hold','completed','completed','cancelled'])[r.rn]::project_status stt,
    3+(r.rn%8) bv, 2+(r.rn%7) tc, 1+(r.rn%6) rr, 1+(r.rn%5) js) v
 join lateral (select id, po_user_id from squad where tenant_id=T and squad_type='domain' order by md5(r.id::text||'sq') limit 1) sq on true;
 insert into project (tenant_id, name, description, project_type, source_type, status, sponsor_user_id, owner_user_id, squad_id, lead_squad_id, business_unit_id, business_value, time_criticality, risk_reduction, job_size, planned_start, planned_end, initiative_type)
 select T, 'Iniciativa propuesta '||g, 'Iniciativa en evaluacion inicial de portafolio.', 'evolution','demand','proposed', daniel, sq.po_user_id, sq.id, sq.id,
   (select id from business_unit where tenant_id=T order by md5(g::text||'bu2') limit 1), 5,4,3,2, date '2026-08-01', date '2027-01-01', 'demand'
 from generate_series(1,2) g
 join lateral (select id, po_user_id from squad where tenant_id=T and squad_type='domain' order by md5(g::text||'sq2') limit 1) sq on true;
 update project_recommendation pr set created_project_id = p.id from project p where p.created_from_recommendation_id = pr.id and pr.tenant_id=T;
 insert into project_incident_link (tenant_id, project_id, incident_id, link_type, linked_by)
 select T, p.id, p.created_from_incident_id, 'source', daniel from project p where p.created_from_incident_id is not null and p.tenant_id=T;
 insert into project_incident_link (tenant_id, project_id, incident_id, link_type, linked_by)
 select T, (select id from project where tenant_id=T order by md5(i.id::text) limit 1), i.id, 'related', daniel
 from incident i where i.tenant_id=T and i.status='in_evolution'
   and i.id not in (select created_from_incident_id from project where created_from_incident_id is not null and tenant_id=T);
end $$;

-- project_task / project_squad / project_risk / project_validation
do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128'; juan uuid;
begin
 select tm.id into juan from team_member tm join user_account u on u.id=tm.user_id where u.email='squads@credix.local';
 insert into project_task (tenant_id, project_id, title, description, owner_user_id, status, priority, due_date, completed_at, effort_points, assigned_member_id, created_at)
 select T, p.id, 'Tarea '||k||' de '||left(p.name,40), 'Actividad del proyecto de evolucion.', p.owner_user_id, x.stt, x.pr,
   (p.created_at + make_interval(days=>k*2))::date, (case when x.stt='done' then p.created_at - make_interval(days=>1+(k%15)) end), 1+(k%8),
   (case when k%4=0 then juan else (select sm.member_id from squad_member sm where sm.squad_id=p.squad_id order by md5(p.id::text||k::text) limit 1) end), p.created_at
 from project p cross join lateral generate_series(1, 8+(abs(hashtext(p.id::text))%8)) k
 cross join lateral (select (array['todo','doing','blocked','done','done','doing','todo','done'])[1+(k%8)] stt, (array['p1_critical','p2_high','p3_medium','p4_low'])[1+(k%4)]::priority_level pr) x
 where p.tenant_id=T;
 insert into project_squad (tenant_id, project_id, squad_id, role, allocation_pct) select T, p.id, p.squad_id, 'lead', 60 from project p where p.tenant_id=T and p.squad_id is not null;
 insert into project_squad (tenant_id, project_id, squad_id, role, allocation_pct)
 select T, p.id, s.id, 'contributing', 30 from project p cross join lateral (select id from squad where tenant_id=T and id <> p.squad_id order by md5(p.id::text||'c') limit (1+(abs(hashtext(p.id::text))%2))) s where p.tenant_id=T;
 insert into project_risk (tenant_id, project_id, kind, title, description, severity, status, owner_user_id, related_squad_id, due_date)
 select T, p.id, (array['risk','blocker','dependency'])[1+(k%3)], 'Riesgo '||k||' del proyecto', 'Descripcion del riesgo o dependencia.',
   (array['low','medium','high','critical'])[1+(k%4)], (array['open','mitigating','resolved'])[1+(k%3)], p.owner_user_id, p.squad_id, (p.created_at + interval '30 days')::date
 from project p cross join lateral generate_series(1, 2+(abs(hashtext(p.id::text))%3)) k where p.tenant_id=T;
 insert into project_validation (tenant_id, project_id, name, test_type, environment, result, notes, run_by, run_at)
 select T, p.id, 'Validacion '||k, (array['functional','regression','integration','uat','smoke'])[1+(k%5)],
   (array['test','staging','preprod'])[1+(k%3)], (array['pass','pass','fail','blocked','pass'])[1+(k%5)], 'Resultado de la prueba de validacion.', p.owner_user_id, p.created_at - make_interval(days=>k)
 from project p cross join lateral generate_series(1, 3+(abs(hashtext(p.id::text))%4)) k where p.tenant_id=T and p.status in ('active','completed');
end $$;

-- change_request(14) + workflow_instance + steps
do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128'; daniel uuid; wfch uuid;
begin
 select id into daniel from user_account where email='evolucion@credix.local';
 select id into wfch from workflow_definition where code='WF-CHANGE-CAB' and tenant_id=T;
 insert into change_request (tenant_id, title, description, change_type, risk_level, priority, status, justification, implementation_plan, rollback_plan, affected_ci_id, affected_service_id, related_incident_id, related_problem_id, requested_by, assigned_to, planned_start, planned_end, actual_start, actual_end, cab_decision, cab_decision_at, cab_decision_by, cab_notes)
 select T, 'Cambio '||g||' - '||x.stt, 'Solicitud de cambio para atender evolucion o problema.',
   (array['standard','normal','emergency'])[1+(g%3)], (array['low','medium','high'])[1+(g%3)], (array['p1_critical','p2_high','p3_medium','p4_low'])[1+(g%4)]::priority_level,
   x.stt, 'Justificacion del cambio.', 'Plan de implementacion detallado.', 'Plan de rollback definido.',
   (select id from configuration_item where tenant_id=T order by md5(g::text||'ci') limit 1),
   (select id from service where tenant_id=T order by md5(g::text||'sv') limit 1),
   (select id from incident where tenant_id=T and status='in_evolution' order by md5(g::text||'inc') limit 1),
   (case when g%2=0 then (select id from problem where tenant_id=T order by md5(g::text||'pb') limit 1) end),
   daniel, (select po_user_id from squad where tenant_id=T and squad_type='domain' order by md5(g::text||'sq') limit 1),
   timestamptz '2026-05-01 08:00-06' + make_interval(days=>g*3), timestamptz '2026-05-01 08:00-06' + make_interval(days=>g*3+1),
   (case when x.stt in ('implementing','review','closed') then timestamptz '2026-05-02 08:00-06' + make_interval(days=>g*3) end),
   (case when x.stt='closed' then timestamptz '2026-05-03 08:00-06' + make_interval(days=>g*3) end),
   (case when x.stt in ('approved','scheduled','implementing','review','closed') then 'approved' when x.stt='rejected' then 'rejected' end),
   (case when x.stt in ('approved','scheduled','implementing','review','closed','rejected') then timestamptz '2026-05-01 12:00-06' + make_interval(days=>g*3) end),
   (case when x.stt in ('approved','scheduled','implementing','review','closed','rejected') then daniel end),
   (case when x.stt in ('approved','scheduled','implementing','review','closed') then 'Aprobado por CAB.' when x.stt='rejected' then 'Rechazado por CAB.' end)
 from generate_series(1,14) g
 cross join lateral (select (array['draft','assessment','pending_cab','approved','scheduled','implementing','review','closed','rejected','cancelled','approved','implementing','closed','pending_cab'])[g] stt) x;
 insert into workflow_instance (tenant_id, definition_id, entity_type, entity_id, title, status, started_by, started_at, completed_at)
 select T, wfch, 'change', c.id, 'Cambio '||c.change_number,
   (case when c.status in ('closed','review') then 'completed' when c.status='cancelled' then 'cancelled' else 'running' end),
   c.requested_by, c.planned_start, (case when c.status in ('closed','review') then coalesce(c.actual_end, c.planned_end) end)
 from change_request c where c.tenant_id=T;
 update change_request c set workflow_instance_id = wi.id from workflow_instance wi where wi.entity_id=c.id and wi.entity_type='change' and c.tenant_id=T;
 insert into workflow_step (tenant_id, instance_id, node_id, status, outcome, activated_at, completed_at)
 select T, wi.id, n.id, (case when wi.status in ('completed','cancelled') then 'done' when n.sort_order < 2 then 'done' when n.sort_order=2 then 'active' else 'skipped' end),
   (case when wi.status='completed' or n.sort_order<2 then 'ok' end),
   wi.started_at + make_interval(hours=>n.sort_order), (case when wi.status='completed' or n.sort_order<2 then wi.started_at + make_interval(hours=>n.sort_order+1) end)
 from workflow_instance wi join workflow_node n on n.definition_id=wi.definition_id where wi.entity_type='change' and wi.tenant_id=T;
end $$;
