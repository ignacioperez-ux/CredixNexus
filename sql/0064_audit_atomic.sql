-- 0064_audit_atomic.sql
-- Audit-grade §11: las operaciones que crean un caso ANCLA + un registro dependiente deben
-- ser atomicas (todo o nada) para que el ledger y las filas de negocio se confirmen o
-- reviertan juntos. Se encapsulan en funciones PL/pgSQL (una funcion = una transaccion),
-- SECURITY INVOKER (respetan RLS y el actor real via auth.uid()). Los triggers de auditoria
-- escriben el immutable_audit_event dentro de la misma transaccion.

-- ---- Observability: alerta -> caso (insert incident + correlacion de alerta, atomico) ----
create or replace function public.create_case_from_alert(p_alert_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_tenant   uuid := public.current_tenant_id();
  v_actor    uuid := (select id from public.user_account where auth_user_id = auth.uid());
  v_alert    public.monitoring_alert%rowtype;
  v_impact   impact_level;
  v_urgency  urgency_level;
  v_priority priority_level;
  v_area     uuid;
  v_incident uuid;
begin
  if v_tenant is null then raise exception 'no_tenant'; end if;
  select * into v_alert from public.monitoring_alert where id = p_alert_id and tenant_id = v_tenant;
  if not found then raise exception 'alert_not_found'; end if;
  if v_alert.status in ('correlated','resolved') then raise exception 'invalid_state'; end if;

  case v_alert.severity
    when 'critical' then v_impact := 'critical'; v_urgency := 'critical';
    when 'high'     then v_impact := 'high';     v_urgency := 'high';
    when 'medium'   then v_impact := 'medium';   v_urgency := 'medium';
    else                 v_impact := 'low';      v_urgency := 'low';
  end case;
  v_priority := public.derive_priority(v_impact, v_urgency);

  select id into v_area from public.delivery_area where tenant_id = v_tenant and code = 'operations' limit 1;

  insert into public.incident (tenant_id, title, description, category, source_channel, impact, urgency, priority, status,
      affected_service_id, affected_ci_id, affected_product_id, delivery_area_id, reported_by_user_id)
  values (v_tenant, v_alert.title,
      coalesce(v_alert.description, v_alert.title)
        || case when v_alert.affected_system is not null then E'\nSistema afectado: ' || v_alert.affected_system else '' end
        || case when v_alert.affected_api is not null then E'\nAPI: ' || v_alert.affected_api else '' end
        || E'\nOrigen: alerta de monitoreo (Observability Center).',
      'monitoring', 'monitoring', v_impact, v_urgency, v_priority, 'new',
      v_alert.affected_service_id, v_alert.affected_ci_id, v_alert.affected_product_id, v_area, v_actor)
  returning id into v_incident;

  update public.monitoring_alert
     set status = 'correlated', correlated_case_id = v_incident, updated_by = v_actor
   where id = p_alert_id;

  return v_incident;
end $$;

-- ---- Service Catalog: solicitud -> caso (insert incident + service_request, atomico) ----
create or replace function public.create_service_request(p_item_id uuid, p_form_data jsonb, p_description text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_tenant   uuid := public.current_tenant_id();
  v_actor    uuid := (select id from public.user_account where auth_user_id = auth.uid());
  v_item     public.service_item%rowtype;
  v_priority priority_level;
  v_incident uuid;
  v_request  uuid;
begin
  if v_tenant is null then raise exception 'no_tenant'; end if;
  select * into v_item from public.service_item where id = p_item_id and tenant_id = v_tenant and status = 'active';
  if not found then raise exception 'item_not_found'; end if;
  v_priority := public.derive_priority(v_item.default_impact, v_item.default_urgency);

  insert into public.incident (tenant_id, title, description, category, case_type, source_channel, impact, urgency, priority, status,
      delivery_area_id, reported_by_user_id)
  values (v_tenant, 'Solicitud: ' || v_item.name, coalesce(p_description, 'Solicitud de servicio: ' || v_item.name),
      coalesce(v_item.category, 'service_request'), 'Request', 'service_catalog',
      v_item.default_impact, v_item.default_urgency, v_priority, 'new', v_item.delivery_area_id, v_actor)
  returning id into v_incident;

  insert into public.service_request (tenant_id, item_id, incident_id, requested_by_user_id, form_data, sla_due_at, status, created_by)
  values (v_tenant, p_item_id, v_incident, v_actor, coalesce(p_form_data, '{}'::jsonb),
      now() + (v_item.sla_hours || ' hours')::interval, 'open', v_actor)
  returning id into v_request;

  return jsonb_build_object('incident_id', v_incident, 'request_id', v_request);
end $$;
