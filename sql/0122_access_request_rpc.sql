-- 0122_access_request_rpc.sql
-- SSO Entra ID (FASE PREPARATORIA): RPC de "solicitar acceso" para una identidad FEDERADA
-- NO APROVISIONADA. Un usuario que se autentica por Azure pero no tiene user_account no tiene
-- tenant ni contexto -> no puede usar el flujo normal del catalogo (create_service_request exige
-- current_tenant_id() + un user_account actor). Esta RPC SECURITY DEFINER registra la solicitud
-- SI_SOLICITUD_ACCESO en el tenant CORE con el email/nombre del token, SIN exigir user_account.
--
-- La usa la pantalla "tu cuenta corporativa aun no tiene acceso" (frontend, tras el flag SSO).
-- Decision del arquitecto (Gate 0 #3). No crea tablas nuevas: reutiliza incident + service_request.
--
-- SEGURIDAD:
--   * Solo identidades autenticadas (auth.uid() no nulo) y SOLO si NO estan aprovisionadas
--     (si ya tienen user_account, la RPC rechaza -> no aplica).
--   * Email tomado del token real (auth.users), no de input del cliente (no falsificable).
--   * Anti-duplicado: si ya hay una solicitud de acceso ABIERTA para ese email, la reutiliza.
--   * reported_by_user_id / requested_by_user_id = null (no hay cuenta): incident lo permite.
--   * revoke a public + grant execute solo a authenticated. SECURITY DEFINER + search_path fijado.
--
-- ROLLBACK:  drop function if exists public.request_access_federated(text);

create or replace function public.request_access_federated(p_full_name text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
declare
  v_uid      uuid := auth.uid();
  v_email    citext;
  v_name     text;
  v_tenant   uuid;
  v_item     public.service_item%rowtype;
  v_priority priority_level;
  v_incident uuid;
  v_request  uuid;
  v_existing uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  -- Solo NO aprovisionados: si ya tiene cuenta vinculada, no corresponde solicitar acceso.
  if exists (select 1 from public.user_account where auth_user_id = v_uid) then
    raise exception 'already_provisioned';
  end if;

  -- Email desde el token real (no del cliente): no falsificable.
  select email into v_email from auth.users where id = v_uid;
  if v_email is null then raise exception 'no_email'; end if;
  v_name := coalesce(nullif(btrim(p_full_name), ''), split_part(v_email::text, '@', 1));

  select id into v_tenant from public.tenant where code = 'CORE' and status = 'active' limit 1;
  if v_tenant is null then raise exception 'no_tenant'; end if;

  select * into v_item from public.service_item
    where code = 'SI_SOLICITUD_ACCESO' and tenant_id = v_tenant and status = 'active';
  if not found then raise exception 'item_not_found'; end if;

  -- Anti-duplicado: reutiliza una solicitud de acceso ABIERTA existente para el mismo email.
  select i.id into v_existing
    from public.incident i
   where i.tenant_id = v_tenant
     and i.case_type = 'Request'
     and i.title = 'Solicitud de acceso - ' || v_email::text
     and i.status not in ('resolved', 'closed', 'cancelled')
   limit 1;
  if v_existing is not null then
    return jsonb_build_object('incident_id', v_existing, 'duplicate', true);
  end if;

  v_priority := public.derive_priority(v_item.default_impact, v_item.default_urgency);

  insert into public.incident (tenant_id, title, description, category, case_type, source_channel,
      impact, urgency, priority, status, delivery_area_id, reported_by_user_id)
  values (v_tenant,
      'Solicitud de acceso - ' || v_email::text,
      'Solicitud de acceso SSO (identidad federada sin cuenta pre-aprovisionada).' || chr(10) ||
      'Email corporativo: ' || v_email::text || chr(10) || 'Nombre: ' || v_name,
      coalesce(v_item.category, 'acceso'), 'Request', 'service_catalog',
      v_item.default_impact, v_item.default_urgency, v_priority, 'new', v_item.delivery_area_id, null)
  returning id into v_incident;

  insert into public.service_request (tenant_id, item_id, incident_id, requested_by_user_id, form_data, sla_due_at, status)
  values (v_tenant, v_item.id, v_incident, null,
      jsonb_build_object('email', v_email::text, 'full_name', v_name, 'origin', 'sso_no_provision'),
      now() + (v_item.sla_hours || ' hours')::interval, 'open')
  returning id into v_request;

  return jsonb_build_object('incident_id', v_incident, 'request_id', v_request, 'duplicate', false);
end;
$function$;

revoke all on function public.request_access_federated(text) from public;
grant execute on function public.request_access_federated(text) to authenticated;
