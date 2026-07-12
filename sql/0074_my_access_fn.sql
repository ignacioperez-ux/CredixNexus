-- 0074_my_access_fn.sql
-- Une my_permissions + my_roles en UNA sola RPC (menos viajes a Supabase por pagina).
-- getAccessControl (session.ts) pasa de 2 round trips a 1. SECURITY DEFINER (lee tablas de rol).

create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select jsonb_build_object(
    'perms', coalesce((
      select array_agg(distinct p.code)
      from public.user_account ua
      join public.user_role ur on ur.user_id = ua.id and (ur.valid_to is null or ur.valid_to > now())
      join public.role_permission rp on rp.role_id = ur.role_id
      join public.permission p on p.id = rp.permission_id
      where ua.auth_user_id = auth.uid()
    ), array[]::text[]),
    'roles', coalesce((
      select array_agg(distinct r.code)
      from public.user_account ua
      join public.user_role ur on ur.user_id = ua.id and (ur.valid_to is null or ur.valid_to > now())
      join public.role r on r.id = ur.role_id
      where ua.auth_user_id = auth.uid()
    ), array[]::text[])
  );
$$;

grant execute on function public.my_access() to authenticated, anon;
