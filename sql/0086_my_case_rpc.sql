-- 0086_my_case_rpc.sql
-- Detalle de caso PROPIO del usuario (P2), seguro por diseno. En vez de abrir la RLS de
-- incident (romperia la busqueda de deflection y expondria PII de otros), se exponen RPCs
-- SECURITY DEFINER que EXIGEN propiedad (reported_by_user_id = current_account_id()) y
-- devuelven solo campos seguros y comentarios NO internos. Todo mutacion queda auditada por
-- los triggers de las tablas base.

-- ---- Lectura del caso propio (campos seguros de tracking) ----
create or replace function public.get_my_case(p_id uuid)
returns table (
  id uuid, incident_number text, title text, description text, status text, priority text,
  category text, opened_at timestamptz, first_response_at timestamptz, resolved_at timestamptz,
  sla_response_due_at timestamptz, sla_resolution_due_at timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  select i.id, i.incident_number::text, i.title::text, i.description::text, i.status::text,
         i.priority::text, i.category::text, i.opened_at, i.first_response_at, i.resolved_at,
         i.sla_response_due_at, i.sla_resolution_due_at
  from public.incident i
  where i.id = p_id
    and i.reported_by_user_id = public.current_account_id();
$$;
revoke execute on function public.get_my_case(uuid) from public, anon;
grant execute on function public.get_my_case(uuid) to authenticated, service_role;

-- ---- Hilo del caso propio: comentarios NO internos (nunca notas internas del agente) ----
create or replace function public.get_my_case_thread(p_id uuid)
returns table (id uuid, body text, created_at timestamptz, is_system_generated boolean, is_mine boolean)
language sql stable security definer set search_path = public, auth as $$
  select c.id, c.body, c.created_at, c.is_system_generated,
         (c.author_user_id = public.current_account_id()) as is_mine
  from public.incident_comment c
  join public.incident i on i.id = c.incident_id
  where c.incident_id = p_id
    and i.reported_by_user_id = public.current_account_id()
    and coalesce(c.visibility, 'partner') <> 'internal'
  order by c.created_at asc;
$$;
revoke execute on function public.get_my_case_thread(uuid) from public, anon;
grant execute on function public.get_my_case_thread(uuid) to authenticated, service_role;

-- ---- Responder en el hilo (comentario visible para la mesa, owner-check) ----
create or replace function public.add_my_case_comment(p_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_tenant uuid; v_acc uuid; v_new uuid;
begin
  v_acc := public.current_account_id();
  select tenant_id into v_tenant from public.incident where id = p_id and reported_by_user_id = v_acc;
  if v_tenant is null then raise exception 'not_owner'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'empty_body'; end if;
  insert into public.incident_comment (tenant_id, incident_id, author_user_id, body, visibility)
  values (v_tenant, p_id, v_acc, btrim(p_body), 'partner')
  returning id into v_new;
  return v_new;
end $$;
revoke execute on function public.add_my_case_comment(uuid, text) from public, anon;
grant execute on function public.add_my_case_comment(uuid, text) to authenticated, service_role;

-- ---- Enviar CSAT (Resolucion/Rapidez/Atencion 1..5 + comentario) y CERRAR el caso ----
-- Regla de negocio (P4): un envio = una evaluacion; al enviar, el caso se cierra. Auditado.
create or replace function public.submit_case_csat(
  p_id uuid, p_resolution smallint, p_speed smallint, p_attention smallint, p_comment text
)
returns void language plpgsql security definer set search_path = public, auth as $$
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

  -- 1 a 1 y cierre del caso al enviar la evaluacion.
  update public.incident set status = 'closed' where id = p_id;
end $$;
revoke execute on function public.submit_case_csat(uuid, smallint, smallint, smallint, text) from public, anon;
grant execute on function public.submit_case_csat(uuid, smallint, smallint, smallint, text) to authenticated, service_role;
