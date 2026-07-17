-- FASE 5 · Ola B — Operaciones/GRC: problemas + MI + disputas + fraude + riesgo + alertas + DX events
-- B1: problems + problem_incident + major_incident + updates
do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128'; giss uuid; mich uuid;
begin
 select id into giss from user_account where email='operaciones@credix.local';
 select id into mich from user_account where email='michael.venegas@credix.local';
 insert into problem (tenant_id, title, description, status, priority, category, root_cause_summary, known_error, affected_ci_id, affected_service_id, owner_user_id, opened_at, resolved_at, closed_at)
 select T, 'Problema recurrente '||g||' - analisis de causa raiz', 'Problema derivado de incidentes recurrentes; en gestion por Operaciones.',
   st, pri, 'INFRASTRUCTURE',
   (case when g in (2,4) then 'Causa raiz identificada: defecto en componente y falta de control.' when st in ('resolved','closed') then 'RCA completada y documentada.' end),
   (g in (2,4)),
   (select id from configuration_item where tenant_id=T and ci_type='core' order by md5(g::text) limit 1),
   (select id from service where tenant_id=T order by md5(g::text||'s') limit 1), giss,
   timestamptz '2026-06-01 09:00-06' - make_interval(days=>g*5),
   (case when st in ('resolved','closed') then timestamptz '2026-06-22 09:00-06' - make_interval(days=>g) end),
   (case when st='closed' then timestamptz '2026-06-26 09:00-06' - make_interval(days=>g) end)
 from generate_series(1,8) g
 cross join lateral (select (array['investigating','known_error','investigating','known_error','resolved','closed','new','investigating'])[g] st,
                            (array['high','critical','medium','high','medium','low','high','medium'])[g] pri) x;
 insert into problem_incident (tenant_id, problem_id, incident_id, note, linked_by)
 select T, p.id, i.id, 'Incidente vinculado al problema.', giss from problem p
 cross join lateral (select id from incident where tenant_id=T and intake_status='accepted' order by md5(p.id::text||id::text) limit (2+(abs(hashtext(p.id::text))%3))) i;
 insert into major_incident (tenant_id, incident_id, title, severity, status, commander_user_id, comms_lead_user_id, summary, impact_summary, bridge_url, declared_at, next_update_due_at, resolved_at, stood_down_at)
 select T, p.id, (array['Caida de pasarela de pagos','Degradacion de originacion','Incidencia de conciliacion masiva'])[p.rn],
   (array['sev1','sev1','sev2'])[p.rn], (array['mitigating','resolved','stood_down'])[p.rn], giss, mich,
   'Incidente mayor declarado; sala de crisis activa y comunicacion client-centric.', 'Impacto en clientes y transacciones; mitigacion en curso.',
   'https://meet.credix.local/mi-'||p.rn, p.opened_at + interval '30 minutes',
   (case when p.rn=1 then now() - interval '2 hours' end),
   (case when p.rn=2 then p.opened_at + interval '6 hours' end),
   (case when p.rn=3 then p.opened_at + interval '8 hours' end)
 from (select id, opened_at, row_number() over (order by md5(id::text)) rn from incident where tenant_id=T and priority='p1_critical' and status in ('resolved','closed','in_progress') limit 3) p;
 insert into major_incident_update (tenant_id, mi_id, update_type, body, posted_by, posted_at)
 select T, mi.id, (array['status','customer','internal','stakeholder'])[1+(k%4)], 'Actualizacion '||k||': avance de mitigacion y proximo punto de control.', giss, mi.declared_at + make_interval(hours=>k)
 from major_incident mi cross join lateral generate_series(1, 5+(abs(hashtext(mi.id::text))%4)) k where mi.tenant_id=T;
end $$;

-- B2: dispute + fraud + risk
do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128'; giss uuid; prisma uuid;
begin
 select id into giss from user_account where email='operaciones@credix.local';
 select id into prisma from vendor where code='VND-PRISMA' and tenant_id=T;
 insert into dispute_case (tenant_id, incident_id, dispute_type, status, disputed_amount, amount_recovered, currency, transaction_reference, processor_vendor_id, assigned_to_user_id, opened_at, due_date, resolved_at, closed_at, reason_code)
 select T, i.id, (array['unrecognized_charge','duplicate_charge','payment_not_applied','incorrect_amount','service_not_received','refund_pending'])[1+(i.rn%6)],
   x.stt, round((5000+(abs(hashtext(i.id::text))%500000))::numeric,2),
   (case when x.stt='won' then round((5000+(abs(hashtext(i.id::text))%100000))::numeric,2) else 0 end),
   'CRC', coalesce(i.transaction_reference,'TXN-2026-D'||i.rn), prisma, giss, i.opened_at, (i.opened_at + interval '30 days')::date,
   (case when x.stt in ('won','lost','closed') then i.opened_at + interval '15 days' end),
   (case when x.stt='closed' then i.opened_at + interval '20 days' end), 'RC-'||(1+(i.rn%9))
 from (select id, opened_at, transaction_reference, row_number() over (order by md5(id::text)) rn from incident where tenant_id=T and category in ('DISPUTE','DUPLICATE_CHARGE','UNRECOGNIZED_CHARGE') and intake_status='accepted' limit 12) i
 cross join lateral (select (array['opened','investigating','awaiting_customer','submitted','won','lost','closed','investigating','won','opened','submitted','closed'])[i.rn] stt) x;
 insert into fraud_case (tenant_id, incident_id, fraud_type, status, detection_source, risk_score, amount_exposed, amount_recovered, currency, assigned_to_user_id, reported_at, confirmed_at, recovered_at, closed_at)
 select T, i.id, (array['card_not_present','account_takeover','identity_theft','phishing','friendly_fraud','merchant_fraud','card_not_present','other'])[i.rn],
   x.stt, (array['customer_report','monitoring_alert','manual_review','rule_engine'])[1+(i.rn%4)],
   60+(abs(hashtext(i.id::text))%36), round((10000+(abs(hashtext(i.id::text))%1000000))::numeric,2),
   (case when x.stt='recovered' then round((5000+(abs(hashtext(i.id::text))%200000))::numeric,2) else 0 end),
   'CRC', giss, i.opened_at,
   (case when x.stt in ('confirmed','recovered','closed') then i.opened_at + interval '2 days' end),
   (case when x.stt='recovered' then i.opened_at + interval '10 days' end),
   (case when x.stt='closed' then i.opened_at + interval '12 days' end)
 from (select id, opened_at, row_number() over (order by md5(id::text)) rn from incident where tenant_id=T and category='FRAUD_SUSPICION' and intake_status='accepted' limit 8) i
 cross join lateral (select (array['reported','investigating','confirmed','false_positive','recovered','closed','investigating','confirmed'])[i.rn] stt) x;
 insert into risk_event (tenant_id, incident_id, event_date, risk_category, description, root_cause, control_failure, estimated_loss, actual_loss, recovered_amount, currency, owner_user_id, status, due_date)
 select T, i.id, i.opened_at::date, 'operational', 'Evento de riesgo operativo derivado del incidente; en tratamiento por GRC.',
   'Causa raiz en proceso o control.', 'Control preventivo insuficiente.',
   x.est, round((x.est*0.6)::numeric,2), round((x.est*0.6*0.3)::numeric,2), 'CRC', giss, x.stt, (i.opened_at + interval '45 days')::date
 from (select id, opened_at, row_number() over (order by md5(id::text)) rn from incident where tenant_id=T and category='OPERATIONAL_RISK' limit 10) i
 cross join lateral (select (array['open','assessing','mitigating','closed','accepted','open','mitigating','closed','assessing','open'])[i.rn] stt,
                            round((50000+(abs(hashtext(i.id::text))%2000000))::numeric,2) est) x;
end $$;

-- B3: monitoring_alert(40) + digital_experience_event(400)
do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128';
begin
 insert into monitoring_alert (tenant_id, source, alert_type, severity, title, description, affected_system, affected_ci_id, affected_service_id, correlated_case_id, major_incident_id, status, first_seen_at, last_seen_at, occurrence_count, raw_payload)
 select T, (array['datadog','prometheus','sentinel','monitor'])[1+(g%4)], (array['latency','error_rate','availability','saturation'])[1+(g%4)],
   (array['critical','high','medium','low','info'])[1+(g%5)], 'Alerta '||g||' - '||(array['latencia','tasa de error','disponibilidad','saturacion'])[1+(g%4)],
   'Alerta generada por monitoreo automatico.', (array['SAC','Pasarela','MiCredix','Prisma'])[1+(g%4)],
   (select id from configuration_item where tenant_id=T order by md5(g::text||'ci') limit 1),
   (select id from service where tenant_id=T order by md5(g::text||'sv') limit 1),
   (case when g%10 < 6 then (select id from incident where tenant_id=T and intake_status='accepted' order by md5(g::text||'inc') limit 1) end),
   (case when g%10 < 2 then (select id from major_incident where tenant_id=T order by md5(g::text||'mi') limit 1) end),
   (case when g%10 < 6 then 'correlated' else (array['open','acknowledged','resolved'])[1+(g%3)] end),
   tt.ts, tt.ts + interval '2 hours', 2+(g%20),
   jsonb_build_object('metric',(array['latency_ms','error_pct','uptime_pct','cpu_pct'])[1+(g%4)],'value',(g*13)%100,'threshold',80,'host','node-'||(g%8))
 from generate_series(1,40) g
 cross join lateral (select timestamptz '2026-07-10 08:00-06' - make_interval(days=>g%40, hours=>g%12) ts) tt;
 insert into digital_experience_event (tenant_id, channel, journey_name, step_name, user_type, device_type, status, response_time_ms, error_code, error_message, customer_id, session_id, occurred_at)
 select T, (array['web','mobile','api','ivr','whatsapp'])[1+(g%5)], (array['pago','onboarding','consulta'])[1+(g%3)],
   (array['inicio','autenticacion','confirmacion','resultado'])[1+(g%4)], 'cliente', (array['android','ios','desktop','web'])[1+(g%4)],
   (case when g%12=0 then 'error' when g%25=0 then 'slow' else 'success' end),
   (50 + (abs(hashtext(g::text))%450) + (case when g%12=0 then 3000 when g%25=0 then 1500 else 0 end)),
   (case when g%12=0 then (array['ERR_TIMEOUT','ERR_5XX','ERR_DECLINED'])[1+(g%3)] end),
   (case when g%12=0 then 'Fallo en el paso del journey.' end),
   (select id from party where tenant_id=T and party_type='person' order by md5(g::text||'c') limit 1),
   'sess-'||g, timestamptz '2026-07-14 20:00-06' - make_interval(days=>g%60, hours=>g%24, mins=>g%60)
 from generate_series(1,400) g;
end $$;
