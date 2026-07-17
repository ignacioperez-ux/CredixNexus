-- FASE 5 · Ola E — Conocimiento y periferia
-- E1: knowledge_article(22) + versions + 80 events + 25 feedback (contadores por trigger) + kb_matched en ~30 incidentes
do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128'; tomas uuid;
begin
 select id into tomas from user_account where email='usuario@credix.local';
 with inc as (select id, row_number() over (order by md5(id::text)) rn from incident where tenant_id=T and intake_status='accepted' limit 13),
      pb as (select id, row_number() over (order by md5(id::text)) rn from problem where tenant_id=T limit 3),
      pj as (select id, row_number() over (order by md5(id::text)) rn from project where tenant_id=T limit 2),
      ch as (select id, row_number() over (order by md5(id::text)) rn from change_request where tenant_id=T limit 2),
      mi as (select id, row_number() over (order by md5(id::text)) rn from major_incident where tenant_id=T limit 2)
 insert into knowledge_article (tenant_id, title, category, status, article_type, owner_user_id, source_incident_id, source_problem_id, source_project_id, source_change_id, source_major_incident_id)
 select T, 'Articulo KB '||g||' - '||(array['Solucion de pago no aplicado','Runbook de caida de API','Error conocido de conciliacion','FAQ de acceso','Politica de disputas'])[1+(g%5)],
   'general', (case when g%9=0 then 'draft' else 'active' end)::record_status, (array['how_to','runbook','known_error','faq','policy'])[1+(g%5)],
   (select id from user_account where tenant_id=T and party_id is null and email like '%@credix.local' order by md5(g::text) limit 1),
   (select id from inc where rn=g), (select id from pb where rn=g-13), (select id from pj where rn=g-16), (select id from ch where rn=g-18), (select id from mi where rn=g-20)
 from generate_series(1,22) g;
 insert into knowledge_article_version (tenant_id, article_id, version_number, content_markdown, summary, tags, approved_by, approved_at)
 select T, a.id, k, '# '||a.title||E'\n\n## Sintoma\nDescripcion del sintoma.\n\n## Causa\nCausa raiz identificada.\n\n## Solucion\nPasos verificados para resolver el caso en Credix.',
   'Resumen del articulo, version '||k, array['credix','soporte','kb'],
   (case when a.status='active' then a.owner_user_id end), (case when a.status='active' then a.created_at end)
 from knowledge_article a cross join lateral generate_series(1, 1+(abs(hashtext(a.id::text))%3)) k where a.tenant_id=T;
 insert into knowledge_event (tenant_id, article_id, event_type, user_account_id, source, query, created_at)
 select T, (select id from knowledge_article where tenant_id=T order by md5(g::text||'a') limit 1),
   (array['view','view','view','deflection','escalation'])[1+(g%5)],
   (case when g%5=0 then tomas else (select id from user_account where tenant_id=T order by md5(g::text||'u') limit 1) end),
   (array['kb','portal','incident'])[1+(g%3)], 'busqueda de conocimiento '||g, timestamptz '2026-07-14 12:00-06' - make_interval(days=>g%40)
 from generate_series(1,80) g;
 insert into knowledge_feedback (tenant_id, article_id, user_account_id, helpful, comment, source)
 select T, (select id from knowledge_article where tenant_id=T order by md5(id::text) offset (g%22) limit 1),
   (case when g in (1,7,13,19,25) then tomas else (select id from (select id, row_number() over (order by md5(id::text)) rn from user_account where tenant_id=T and id<>tomas) z where z.rn=g) end),
   (g%4<>0), 'Comentario de feedback sobre el articulo.', (array['kb','portal','incident'])[1+(g%3)]
 from generate_series(1,25) g;
 update incident set kb_matched_article_id = (select id from knowledge_article where tenant_id=T order by md5(incident.id::text) limit 1)
 where id in (select id from incident where tenant_id=T and intake_status='accepted' order by md5(id::text||'kb') limit 30);
end $$;

-- E2: notification(180) + saved_view + ci_relationship(30) + service_dependency(15) + agent_action(25)
do $$
declare T uuid:='c5d2f057-6262-4275-8ba9-16d9617ce128'; andres uuid; juan uuid; tomas uuid; daniel uuid; giss uuid;
begin
 perform setseed(0.42);
 select id into andres from user_account where email='operador@credix.local';
 select id into juan from user_account where email='squads@credix.local';
 select id into tomas from user_account where email='usuario@credix.local';
 select id into daniel from user_account where email='evolucion@credix.local';
 select id into giss from user_account where email='operaciones@credix.local';
 insert into notification (tenant_id, recipient_user_id, type, title, body, entity_type, entity_id, severity, is_read, read_at, created_at)
 select T, r.uid, (array['incident_assigned','sla_breach','comment_added','case_escalated','project_update'])[1+(g%5)],
   'Notificacion '||g, 'Detalle de la notificacion para el usuario.', 'incident',
   (select id from incident where tenant_id=T order by md5(g::text||r.uid::text) limit 1), (array['info','success','warning','critical'])[1+(g%4)],
   (g%10<7), (case when g%10<7 then now() - make_interval(days=>g%10) end), now() - make_interval(days=>g%30, hours=>g%24)
 from generate_series(1,30) g cross join (values (andres),(juan),(tomas),(daniel),(giss)) r(uid);
 insert into notification (tenant_id, recipient_user_id, type, title, body, entity_type, entity_id, severity, is_read, read_at, created_at)
 select T, (select id from user_account where tenant_id=T order by md5(g::text||'nu') limit 1), 'general', 'Aviso general '||g, 'Notificacion del sistema.', 'incident',
   (select id from incident where tenant_id=T order by md5(g::text||'ne') limit 1), 'info', (g%10<7), (case when g%10<7 then now() - make_interval(days=>g%10) end), now() - make_interval(days=>g%30)
 from generate_series(1,30) g;
 insert into saved_view (tenant_id, user_id, scope, name, filters)
 select T, r.uid, (array['incidents','projects','operations'])[1+(k%3)], 'Vista '||k||' de '||r.nm, jsonb_build_object('status',(array['open','in_progress','resolved'])[1+(k%3)],'priority','p2_high')
 from (values (andres,'Andres'),(juan,'Juan'),(tomas,'Tomas'),(daniel,'Daniel'),(giss,'Giselle')) r(uid,nm) cross join lateral generate_series(1, 2+(abs(hashtext(r.uid::text))%3)) k;
 insert into ci_relationship (tenant_id, parent_ci_id, child_ci_id, relationship_type)
 select T, a.id, b.id, (array['depends_on','connects_to','hosts','uses'])[1+(a.rn%4)::int]
 from (select id, row_number() over (order by md5(id::text)) rn from configuration_item where tenant_id=T) a
 join (select id, row_number() over (order by md5(id::text)) rn from configuration_item where tenant_id=T) b on b.rn=a.rn+1 where a.rn <= 30;
 insert into service_dependency (tenant_id, service_id, depends_on_service_id, dependency_type)
 select T, a.id, b.id, (array['sync','async','data','infra','manual'])[1+(a.rn%5)::int]
 from (select id, row_number() over (order by md5(id::text)) rn from service where tenant_id=T) a
 join (select id, row_number() over (order by md5(id::text)) rn from service where tenant_id=T) b on b.rn=(a.rn % 12)+1
 union all
 select T, a.id, b.id, 'infra' from (select id, row_number() over (order by md5(id::text)) rn from service where tenant_id=T) a
 join (select id, row_number() over (order by md5(id::text)) rn from service where tenant_id=T) b on b.rn=((a.rn+1) % 12)+1 where a.rn <= 3;
 insert into agent_action (tenant_id, agent_name, model_provider, model_name, action_type, input_json, output_json, confidence_score, human_review_required, human_reviewed_by, human_reviewed_at, requested_by_user_id, related_entity_type, related_entity_id, status)
 select T, 'credix-agent', 'anthropic', 'claude-opus-4', (array['triage','kb_suggestion','scoring','triage','kb_suggestion'])[1+(g%5)],
   jsonb_build_object('incident_ord', g, 'context','clasificacion asistida'), jsonb_build_object('suggestion','accion recomendada','score', floor(random()*100)),
   round((0.5+random()*0.5)::numeric,2), (g<=5), (case when g<=5 then giss end), (case when g<=5 then now() - interval '1 day' end),
   giss, 'incident', (select id from incident where tenant_id=T order by md5(g::text||'ag') limit 1), 'completed'
 from generate_series(1,25) g;
end $$;
