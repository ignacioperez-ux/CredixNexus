-- 0119_closure_kb_capture.sql
-- FIX: al cerrar un caso via EVALUACION del usuario (submit_case_csat) NO se capturaba conocimiento
-- (esa RPC hacia update status='closed' directo, salteando captureClosureKnowledge del app). Ademas
-- la captura del app se llamaba SIN la solucion (solo el sintoma). Resultado: casos cerrados por CSAT
-- no generaban articulo KB, y los que si, no guardaban "como se solvento".
--
-- Solucion (motor, no superficial): una funcion SQL unica de captura al cierre, idempotente
-- (indice unico en source_incident_id), que incluye SINTOMA (description) + SOLUCION (root_cause +
-- resolution_summary). Se invoca desde submit_case_csat (cierre por evaluacion) y desde changeStatus
-- (cierre/resolucion de staff, via rpc). SECURITY DEFINER: crea el draft sin depender del RLS de KB
-- del actor (el usuario final no tiene permisos de knowledge). No es fatal: si falla, el cierre no
-- se revierte.

create or replace function public.capture_incident_closure_kb(p_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_inc record; v_art uuid; v_title text; v_sol text; v_body text;
begin
  select id, tenant_id, title, description, category, resolution_summary, root_cause_summary
    into v_inc from public.incident where id = p_id;
  if v_inc.id is null then return null; end if;

  -- Idempotente: si ya hay articulo para este caso, no crear otro.
  select id into v_art from public.knowledge_article where source_incident_id = p_id limit 1;
  if v_art is not null then return v_art; end if;

  v_title := left(coalesce(nullif(btrim(v_inc.title), ''), 'Caso cerrado'), 250);
  if length(v_title) < 5 then v_title := left('Caso cerrado ' || v_title, 250); end if;

  -- Solucion = causa raiz + resumen de resolucion (lo que exista); si no hay, placeholder para el equipo.
  v_sol := btrim(concat_ws(E'\n\n', nullif(btrim(v_inc.root_cause_summary), ''), nullif(btrim(v_inc.resolution_summary), '')));

  v_body := '## Caso' || E'\n' || coalesce(btrim(v_inc.title), '') ||
            E'\n\n## Sintoma\n' || coalesce(nullif(btrim(v_inc.description), ''), '—') ||
            E'\n\n## Solucion\n' || coalesce(nullif(v_sol, ''), '_(Completar por el equipo antes de publicar.)_');

  insert into public.knowledge_article (tenant_id, title, category, article_type, status, source_incident_id)
  values (v_inc.tenant_id, v_title, left(coalesce(v_inc.category, 'general'), 80), 'known_error', 'draft', p_id)
  returning id into v_art;

  insert into public.knowledge_article_version (tenant_id, article_id, version_number, content_markdown)
  values (v_inc.tenant_id, v_art, 1, v_body);

  return v_art;
exception when unique_violation then
  -- Carrera: otro camino de cierre ya lo creo.
  select id into v_art from public.knowledge_article where source_incident_id = p_id limit 1;
  return v_art;
end $$;
revoke all on function public.capture_incident_closure_kb(uuid) from public, anon;
grant execute on function public.capture_incident_closure_kb(uuid) to authenticated, service_role;

-- Cierre por EVALUACION del usuario: ahora captura conocimiento al cerrar.
create or replace function public.submit_case_csat(p_id uuid, p_resolution smallint, p_speed smallint, p_attention smallint, p_comment text)
returns void
language plpgsql security definer set search_path to 'public', 'auth' as $function$
declare v_acc uuid; v_tenant uuid; v_overall smallint;
begin
  v_acc := public.current_account_id();
  select tenant_id into v_tenant from public.incident where id = p_id and reported_by_user_id = v_acc;
  if v_tenant is null then raise exception 'not_owner'; end if;
  if p_resolution not between 1 and 5 or p_speed not between 1 and 5 or p_attention not between 1 and 5 then
    raise exception 'bad_score';
  end if;
  v_overall := round((p_resolution + p_speed + p_attention) / 3.0);

  update public.case_survey
     set q_resolution = p_resolution, q_speed = p_speed, q_attention = p_attention,
         score = v_overall, comment = nullif(btrim(p_comment), ''),
         status = 'submitted', submitted_at = now(), submitted_by = v_acc
   where incident_id = p_id;
  if not found then
    insert into public.case_survey (tenant_id, incident_id, score, q_resolution, q_speed, q_attention, comment, status, submitted_at, submitted_by)
    values (v_tenant, p_id, v_overall, p_resolution, p_speed, p_attention, nullif(btrim(p_comment), ''), 'submitted', now(), v_acc);
  end if;

  update public.incident set status = 'closed' where id = p_id;
  perform public.capture_incident_closure_kb(p_id);
end $function$;
