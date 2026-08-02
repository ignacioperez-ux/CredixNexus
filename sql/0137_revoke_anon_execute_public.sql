-- ============================================================================
-- Credix Nexus — 0137 — Cierre total de EXECUTE a anon [P2, completa 0136]
-- ----------------------------------------------------------------------------
-- 0136 revoco el grant DIRECTO a anon, pero muchas funciones conservan EXECUTE via
-- el pseudo-rol PUBLIC (que anon hereda), asi que el linter seguia marcando ~14
-- funciones SECURITY DEFINER ejecutables por anon. Aqui se cierra por completo:
--
--   1) REVOKE EXECUTE ... FROM anon, public   -> quita la via directa y la heredada.
--   2) GRANT  EXECUTE ... TO authenticated, service_role -> restaura lo que la app
--      necesita (incl. helpers usados dentro de las policies RLS: is_external_partner,
--      current_tenant_id, current_account_id, has_permission) y el rol de servidor.
--
-- Verificado: ninguna RPC se llama pre-login (el flujo federado corre como
-- authenticated). Solo afecta el schema public (las funciones internas de Supabase
-- viven en auth/storage/extensions). Las trigger functions no chequean EXECUTE, asi
-- que no se ven afectadas. IDEMPOTENTE. Reversible (grant a anon,public al pie).
-- ============================================================================

revoke execute on all functions in schema public from anon, public;
grant  execute on all functions in schema public to authenticated, service_role;

-- =============================================================================
-- ROLLBACK:
--   grant execute on all functions in schema public to anon, public;
-- =============================================================================
