-- 0068_my_access.sql
-- Navegacion por rol: expone el conjunto de permisos y roles del usuario autenticado para
-- filtrar la UI (sidebar, acciones). Espeja el patron de has_permission (SECURITY DEFINER,
-- solo el usuario actual via auth.uid()). No cruza tenants: solo lee el propio user_account.

create or replace function public.my_permissions()
returns text[] language sql stable security definer set search_path = public, auth as $$
  select coalesce(array_agg(distinct p.code), array[]::text[])
  from public.user_account ua
  join public.user_role ur on ur.user_id = ua.id and (ur.valid_to is null or ur.valid_to > now())
  join public.role_permission rp on rp.role_id = ur.role_id
  join public.permission p on p.id = rp.permission_id
  where ua.auth_user_id = auth.uid();
$$;

create or replace function public.my_roles()
returns text[] language sql stable security definer set search_path = public, auth as $$
  select coalesce(array_agg(distinct r.code), array[]::text[])
  from public.user_account ua
  join public.user_role ur on ur.user_id = ua.id and (ur.valid_to is null or ur.valid_to > now())
  join public.role r on r.id = ur.role_id
  where ua.auth_user_id = auth.uid();
$$;
