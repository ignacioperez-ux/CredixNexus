-- FASE 5 · Ola A — Mesa de Ayuda: 245 incidentes + comentarios/worklogs/tareas/encuestas/escalamientos/adjuntos
-- Generacion seeded/determinista (hashtext). Triggers asignan numero/SLA/area. Coherencia temporal ene-jul 2026.
-- Reconciliacion de estados (los dos desgloses del prompt son incompatibles: status suma 245, accepted 210):
--   pending->new(20), discarded->cancelled(15), y 210 accepted en estados de flujo (closed ajustado 60->45).

-- ---- incidentes (245) ----
do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128'; tomas uuid; opsarea uuid; evoarea uuid; andres uuid;
begin
 perform setseed(0.42);
 select id into tomas from user_account where email='usuario@credix.local';
 select id into opsarea from delivery_area where code='operations' and tenant_id=T;
 select id into evoarea from delivery_area where code='evolution' and tenant_id=T;
 select tm.id into andres from team_member tm join user_account u on u.id=tm.user_id where u.email='operador@credix.local';

 insert into incident (tenant_id, title, description, category, category_id, case_type,
   priority, impact, urgency, status, intake_status, classified_as, discard_reason,
   reported_by_user_id, affected_party_id, affected_product_id, affected_channel_id, affected_ci_id,
   affected_service_id, affected_business_unit_id, affected_process_id,
   assigned_member_id, assigned_user_id, delivery_area_id,
   opened_at, created_at, triaged_at, first_response_at, resolved_at, closed_at,
   resolution_code, resolution_summary, transformation_candidate, transformation_score,
   amount, currency, transaction_reference, financial_impact_estimate, metadata)
 select T, cat.phrase||' ('||g.i||')',
   'Caso relacionado a '||cat.phrase||'. Seguimiento client-centric de extremo a extremo.',
   cat.code, cat.cid, cat.casetype,
   pr.prio::priority_level, pr.imp::impact_level, pr.urg::urgency_level,
   st.status, st.intake, st.classified, st.discard,
   (case when (g.i%4=1 or g.i>=226) then tomas
         when g.i%6=0 then (select ua.id from user_account ua join user_role ur on ur.user_id=ua.id join role r on r.id=ur.role_id where r.code='responsable_comercial' order by md5(g.i::text||'rc') limit 1)
         else (select id from user_account where tenant_id=T and party_id is not null order by md5(g.i::text||'pu') limit 1) end),
   (case when g.i%2=0 then (select id from party where tenant_id=T order by md5(g.i::text||'pt') limit 1) end),
   (select id from product where tenant_id=T order by md5(g.i::text||'p') limit 1),
   (select id from channel where tenant_id=T order by md5(g.i::text||'ch') limit 1),
   (select id from configuration_item where tenant_id=T order by md5(g.i::text||'ci') limit 1),
   (select id from service where tenant_id=T order by md5(g.i::text||'sv') limit 1),
   (select id from business_unit where tenant_id=T order by md5(g.i::text||'bu') limit 1),
   (select id from process where tenant_id=T and process_level='micro' order by md5(g.i::text||'pr') limit 1),
   asg.member_id, asg.user_id,
   (case when st.status='in_evolution' then evoarea else opsarea end),
   st.opened, st.opened,
   (case when g.i>=36 then st.opened + interval '90 minutes' + make_interval(hours=>(g.i%6)) end),
   (case when g.i>=56 then st.opened + interval '3 hours' + make_interval(hours=>(g.i%10)) end),
   st.resolved, st.closed,
   (case when st.status in ('resolved','closed') then (array['solved','workaround','config_fix','no_fault'])[1+(g.i%4)] end),
   (case when st.status in ('resolved','closed') then 'Resuelto: '||cat.phrase||'. Correccion aplicada y validada con el cliente.' end),
   (st.status='in_evolution'),
   (case when st.status='in_evolution' then 85 + (g.i%12) else 0 end),
   (case when cat.fin then round((10000+(g.i*137)%2000000)::numeric,2) end),
   (case when g.i%7=0 then 'USD' else 'CRC' end),
   (case when cat.fin then 'TXN-2026-'||lpad(g.i::text,6,'0') end),
   (case when cat.fin then round(((g.i*211)%500000)::numeric,2) else 0 end),
   jsonb_build_object('seed','olaA','ord',g.i)
 from generate_series(1,245) g(i)
 join lateral (select (array['PAYMENTS','API_FAILURE','DUPLICATE_CHARGE','UNRECOGNIZED_CHARGE','PAYMENT_NOT_APPLIED','FRAUD_SUSPICION','DISPUTE','RECONCILIATION','ONBOARDING','ACCESS','APPLICATION','INFRASTRUCTURE','SECURITY','DATA_QUALITY','CUSTOMER_COMPLAINT','OPERATIONAL_RISK'])[1+(g.i*7)%16] as code) cc on true
 join lateral (
   select cc.code as code, (select id from incident_category where code=cc.code and tenant_id=T) as cid,
     (case cc.code when 'PAYMENTS' then 'Incidencia de pagos' when 'API_FAILURE' then 'Falla de API de procesador'
        when 'DUPLICATE_CHARGE' then 'Cobro duplicado' when 'UNRECOGNIZED_CHARGE' then 'Cargo no reconocido'
        when 'PAYMENT_NOT_APPLIED' then 'Pago no aplicado' when 'FRAUD_SUSPICION' then 'Sospecha de fraude'
        when 'DISPUTE' then 'Disputa de transaccion' when 'RECONCILIATION' then 'Descuadre de conciliacion'
        when 'ONBOARDING' then 'Problema de onboarding' when 'ACCESS' then 'Problema de acceso'
        when 'APPLICATION' then 'Error de aplicacion' when 'INFRASTRUCTURE' then 'Incidente de infraestructura'
        when 'SECURITY' then 'Incidente de seguridad' when 'DATA_QUALITY' then 'Problema de calidad de datos'
        when 'CUSTOMER_COMPLAINT' then 'Reclamo de cliente' else 'Evento de riesgo operativo' end) as phrase,
     (case cc.code when 'PAYMENTS' then 'PaymentIssue' when 'PAYMENT_NOT_APPLIED' then 'PaymentIssue'
        when 'API_FAILURE' then 'TechnologyIncident' when 'INFRASTRUCTURE' then 'TechnologyIncident' when 'SECURITY' then 'TechnologyIncident'
        when 'DUPLICATE_CHARGE' then 'CardIssue' when 'UNRECOGNIZED_CHARGE' then 'CardIssue'
        when 'FRAUD_SUSPICION' then 'FraudSuspicion' when 'DISPUTE' then 'Dispute'
        when 'CUSTOMER_COMPLAINT' then 'Complaint' when 'OPERATIONAL_RISK' then 'OperationalRisk' else 'Incident' end) as casetype,
     (cc.code in ('PAYMENTS','DUPLICATE_CHARGE','UNRECOGNIZED_CHARGE','PAYMENT_NOT_APPLIED','FRAUD_SUSPICION','DISPUTE')) as fin) cat on true
 join lateral (select
     (case when g.i%13=0 then 'p1_critical' when g.i%9<2 then 'p2_high' when g.i%4=0 then 'p4_low' else 'p3_medium' end) as prio,
     (case when g.i%13=0 then 'critical' when g.i%9<2 then 'high' when g.i%4=0 then 'low' else 'medium' end) as imp,
     (case when g.i%13=0 then 'critical' when g.i%9<2 then 'high' when g.i%4=0 then 'low' else 'medium' end) as urg) pr on true
 join lateral (select
     (case when g.i<=20 then 'new' when g.i<=35 then 'cancelled' when g.i<=55 then 'triaged'
           when g.i<=80 then 'assigned' when g.i<=115 then 'in_progress' when g.i<=130 then 'waiting'
           when g.i<=175 then 'resolved' when g.i<=220 then 'closed' when g.i<=225 then 'reopened'
           else 'in_evolution' end)::incident_status as status,
     (case when g.i<=20 then 'pending' when g.i<=35 then 'discarded' else 'accepted' end) as intake,
     (case when g.i<=35 then null when g.i>=226 then 'project' else 'incident' end) as classified,
     (case when g.i>20 and g.i<=35 then (array['Duplicado de otro caso','Fuera de alcance','Solicitud no procede','Informacion insuficiente'])[1+(g.i%4)] end) as discard,
     (timestamptz '2026-07-14 16:00:00-06' - make_interval(
        days => (case when g.i<=20 then g.i%10 when g.i<=35 then 5+g.i%40 when g.i<=130 then 1+g.i%25
                      when g.i<=175 then 20+g.i%100 when g.i<=220 then 30+g.i%120 when g.i<=225 then 25+g.i%80 else 40+g.i%90 end),
        hours => (g.i*7)%9, mins => (g.i*13)%60)) as opened) st0 on true
 join lateral (select st0.status, st0.intake, st0.classified, st0.discard, st0.opened,
     (case when st0.status in ('resolved','closed','reopened') then st0.opened + make_interval(days=>1+(g.i%9), hours=>(g.i%12)) end) as resolved,
     (case when st0.status='closed' then st0.opened + make_interval(days=>2+(g.i%9), hours=>2+(g.i%40)) end) as closed) st on true
 left join lateral (
   select tm.id as member_id, tm.user_id as user_id from team_member tm
   where tm.tenant_id=T and tm.discipline='Soporte'
     and ( (g.i%5 in (0,1) and tm.name='Andres Gonzalez') or (g.i%5 not in (0,1)) )
   order by (case when tm.name='Andres Gonzalez' and g.i%5 in (0,1) then 0 else 1 end), md5(g.i::text||tm.id::text) limit 1) asg on (g.i>=56);
end $$;

-- ---- hijos: comentarios / worklogs / tareas / encuestas / escalamientos ----
do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128';
begin
 insert into incident_comment (tenant_id, incident_id, author_user_id, visibility, body, is_system_generated, created_at)
 select T, inc.id, case when k=1 then null else coalesce(inc.assigned_user_id, inc.reported_by_user_id) end,
   (array['public','internal','partner'])[1+(k%3)],
   (case when k=1 then 'Caso registrado y clasificado automaticamente por el sistema.' else 'Actualizacion '||k||': gestion en curso; se mantiene informado al cliente.' end),
   (k=1), inc.opened_at + make_interval(hours=>k*2)
 from (select id, opened_at, assigned_user_id, reported_by_user_id from incident where metadata->>'seed'='olaA' and intake_status='accepted') inc
 cross join lateral generate_series(1, 3 + (abs(hashtext(inc.id::text))%4)) k;

 insert into case_work_log (tenant_id, incident_id, member_id, minutes, note, logged_at)
 select T, inc.id, coalesce(inc.assigned_member_id, (select id from team_member where discipline='Soporte' and tenant_id=T order by md5(inc.id::text||k::text) limit 1)),
   15 + (abs(hashtext(inc.id::text||k::text))%180), 'Registro de trabajo en el caso.', inc.opened_at + make_interval(hours=>k*3)
 from (select id, opened_at, assigned_member_id from incident where metadata->>'seed'='olaA' and intake_status='accepted') inc
 cross join lateral generate_series(1, 1+(abs(hashtext(inc.id::text||'w'))%4)) k;

 insert into case_task (tenant_id, incident_id, title, status, position, assigned_to_user_id, done_at, created_at)
 select T, inc.id, 'Tarea '||k||' del caso', (case when k%2=0 then 'done' else 'open' end), k, inc.assigned_user_id,
   (case when k%2=0 then inc.opened_at + make_interval(hours=>k*4) end), inc.opened_at
 from (select id, opened_at, assigned_user_id from incident where metadata->>'seed'='olaA' and intake_status='accepted') inc
 cross join lateral generate_series(1, (abs(hashtext(inc.id::text||'t'))%5)) k;

 insert into case_survey (tenant_id, incident_id, score, q_resolution, q_speed, q_attention, status, submitted_at, comment)
 select T, inc.id, (array[3,4,4,4,5,5,4,2])[1+(abs(hashtext(inc.id::text))%8)],
   (array[3,4,4,5,5,4,3,4])[1+(abs(hashtext(inc.id::text||'r'))%8)], (array[3,4,4,4,5,3,4,2])[1+(abs(hashtext(inc.id::text||'s'))%8)],
   (array[4,4,5,5,4,4,3,5])[1+(abs(hashtext(inc.id::text||'a'))%8)],
   'submitted', coalesce(inc.closed_at, inc.resolved_at) + interval '1 day', 'Gracias por la atencion recibida.'
 from (select id, resolved_at, closed_at from incident where metadata->>'seed'='olaA' and status in ('resolved','closed')) inc
 where (abs(hashtext(inc.id::text||'sv'))%10) < 7;

 insert into escalation_event (tenant_id, incident_id, rule_id, sla_type, threshold_pct, elapsed_pct, action, triggered_at)
 select T, inc.id, er.id, er.sla_type, er.threshold_pct, er.threshold_pct + (abs(hashtext(inc.id::text||er.code))%15), er.action,
   inc.opened_at + make_interval(hours => er.threshold_pct/10)
 from (select id, opened_at from incident where metadata->>'seed'='olaA' and (abs(hashtext(id::text||'esc'))%100) < 15) inc
 cross join escalation_rule er where er.tenant_id=T and er.sla_type='response';

 insert into case_attachment (tenant_id, incident_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
 select T, inc.id, 'seed/adjuntos/'||inc.incident_number||'-evidencia-'||k||'.pdf', inc.incident_number||'-evidencia-'||k||'.pdf',
   'application/pdf', 50000 + (abs(hashtext(inc.id::text||k::text))%2000000), inc.assigned_user_id
 from (select id, incident_number, assigned_user_id from incident where metadata->>'seed'='olaA' and intake_status='accepted') inc
 cross join lateral generate_series(1, (abs(hashtext(inc.id::text||'at'))%3)) k;
end $$;
