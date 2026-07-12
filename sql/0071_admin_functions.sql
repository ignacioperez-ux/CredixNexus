-- 0071_admin_functions.sql
-- Hub de Administracion: funciones para listar/gestionar usuarios y roles desde la UI.
-- SECURITY DEFINER + guard has_permission('user.manage') (tenant_admin/system_admin). Solo
-- opera sobre el tenant del que llama. Anti-lockout: nadie edita su propia cuenta.
-- NO crea cuentas de Auth (eso requiere service_role/invite).
--
-- Auditoria: los cambios de rol/estado se registran con append_audit_event (tenant + actor
-- correctos). NO se usa el trigger generico audit_row_change en user_role: esa tabla no tiene
-- columna tenant_id y el trigger fallaria (romperia login/provisioning y asignacion de roles).

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare v_tenant uuid := public.current_tenant_id();
begin
  if not public.has_permission('user.manage') then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'users_active',  (select count(*) from public.user_account where tenant_id = v_tenant and status = 'active'),
    'users_total',   (select count(*) from public.user_account where tenant_id = v_tenant),
    'roles',         (select count(*) from public.role where tenant_id is null or tenant_id = v_tenant),
    'incidents',     (select count(*) from public.incident where tenant_id = v_tenant),
    'projects',      (select count(*) from public.project where tenant_id = v_tenant),
    'audit_events',  (select count(*) from public.immutable_audit_event where tenant_id = v_tenant)
  );
end $$;

create or replace function public.admin_list_users()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare v_tenant uuid := public.current_tenant_id();
begin
  if not public.has_permission('user.manage') then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'account_id', ua.id, 'full_name', ua.full_name, 'email', ua.email, 'status', ua.status,
      'roles', coalesce((
        select jsonb_agg(r.code order by r.code)
        from public.user_role ur join public.role r on r.id = ur.role_id
        where ur.user_id = ua.id and (ur.valid_to is null or ur.valid_to > now())
      ), '[]'::jsonb)
    ) order by ua.full_name)
    from public.user_account ua where ua.tenant_id = v_tenant
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_list_roles()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare v_tenant uuid := public.current_tenant_id();
begin
  if not public.has_permission('user.manage') then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('code', code, 'name', name) order by name)
    from public.role where tenant_id is null or tenant_id = v_tenant
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_set_user_roles(p_account uuid, p_roles text[])
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_tenant uuid := public.current_tenant_id(); v_self uuid; v_old text[];
begin
  if not public.has_permission('user.manage') then raise exception 'forbidden'; end if;
  select id into v_self from public.user_account where auth_user_id = auth.uid();
  if p_account = v_self then raise exception 'self_forbidden'; end if;
  if not exists (select 1 from public.user_account where id = p_account and tenant_id = v_tenant) then raise exception 'not_found'; end if;

  select coalesce(array_agg(r.code order by r.code), '{}') into v_old
  from public.user_role ur join public.role r on r.id = ur.role_id where ur.user_id = p_account;

  delete from public.user_role where user_id = p_account;
  insert into public.user_role (user_id, role_id)
  select p_account, r.id from public.role r
  where r.code = any(p_roles) and (r.tenant_id is null or r.tenant_id = v_tenant)
  on conflict do nothing;

  perform public.append_audit_event(v_tenant, 'user'::actor_type, v_self, 'user.roles_changed', 'user_account', p_account,
    jsonb_build_object('before', v_old, 'after', p_roles));
end $$;

create or replace function public.admin_set_user_status(p_account uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_tenant uuid := public.current_tenant_id(); v_self uuid;
begin
  if not public.has_permission('user.manage') then raise exception 'forbidden'; end if;
  select id into v_self from public.user_account where auth_user_id = auth.uid();
  if p_account = v_self then raise exception 'self_forbidden'; end if;
  update public.user_account set status = (case when p_active then 'active' else 'inactive' end)::record_status
  where id = p_account and tenant_id = v_tenant;

  perform public.append_audit_event(v_tenant, 'user'::actor_type, v_self,
    case when p_active then 'user.activated' else 'user.deactivated' end, 'user_account', p_account, '{}'::jsonb);
end $$;
