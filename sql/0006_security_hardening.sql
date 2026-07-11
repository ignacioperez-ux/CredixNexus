-- ============================================================================
-- Credix Nexus — 0006 — Endurecimiento de seguridad (advisors)
-- 1) Cierra hueco: funciones SECURITY DEFINER del ledger NO deben ser invocables
--    por anon/authenticated via RPC (evita forjar eventos del ledger).
-- 2) Fija search_path en funciones que lo tenian mutable.
-- ============================================================================

-- 1) Revocar EXECUTE de las funciones sensibles a roles expuestos por PostgREST.
--    Los triggers siguen ejecutandolas (no requieren grant); el server usa service_role.
revoke execute on function public.append_audit_event(uuid, actor_type, uuid, varchar, varchar, uuid, jsonb, uuid, uuid, uuid, inet, text) from public, anon, authenticated;
grant  execute on function public.append_audit_event(uuid, actor_type, uuid, varchar, varchar, uuid, jsonb, uuid, uuid, uuid, inet, text) to service_role;

revoke execute on function public.audit_row_change() from public, anon, authenticated;
revoke execute on function public.audit_tenant_change() from public, anon, authenticated;

-- current_tenant_id se usa dentro de las policies RLS: authenticated SI debe poder
-- ejecutarla; anon no la necesita.
revoke execute on function public.current_tenant_id() from public, anon;
grant  execute on function public.current_tenant_id() to authenticated, service_role;

-- 2) search_path inmutable en funciones que lo tenian mutable
alter function public.set_updated_at() set search_path = public;
alter function public.prevent_audit_mutation() set search_path = public;
alter function public.verify_audit_chain(uuid) set search_path = public;
