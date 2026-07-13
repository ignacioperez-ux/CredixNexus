-- 0084_service_request_owner_rls.sql
-- Seguridad (P3 / UX-002, UX-003): la LECTURA de solicitudes de servicio se restringe al
-- PROPIETARIO, salvo que el usuario tenga service_catalog.manage (gestor: ve todas).
-- Defense-in-depth sobre el scoping de aplicacion (lib/catalog/queries.ts + owner-check en el
-- detalle). NO toca escrituras (INSERT/UPDATE/DELETE ni el RPC create_service_request):
-- solo estrecha SELECT mediante una policy RESTRICTIVE (se combina en AND con la de tenant).

-- Helper: id de user_account del usuario autenticado (espeja current_tenant_id / has_permission).
create or replace function public.current_account_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select (select ua.id
            from public.user_account ua
           where ua.auth_user_id = auth.uid()
           limit 1);
$$;
comment on function public.current_account_id() is
  'user_account.id del usuario autenticado (auth.uid()); para RLS por propietario.';
revoke execute on function public.current_account_id() from public, anon;
grant execute on function public.current_account_id() to authenticated, service_role;

-- Policy RESTRICTIVE de SELECT sobre service_request.
-- Neto de SELECT = (tenant propio, por service_request_isolation) AND (gestor OR solicitante).
-- Los caminos de escritura siguen gobernados solo por la policy de tenant (sin cambios).
drop policy if exists service_request_read_scope on public.service_request;
create policy service_request_read_scope on public.service_request
  as restrictive
  for select
  to authenticated
  using (
    public.has_permission('service_catalog.manage')
    or requested_by_user_id = public.current_account_id()
  );
