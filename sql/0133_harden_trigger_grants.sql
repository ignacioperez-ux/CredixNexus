-- ============================================================================
-- Credix Nexus — 0133 — Endurecimiento: revocar EXECUTE de trigger functions del SSO
-- ----------------------------------------------------------------------------
-- Los advisors de seguridad marcan handle_new_user() y audit_user_role_change()
-- como SECURITY DEFINER ejecutables por anon/authenticated. Son TRIGGER FUNCTIONS:
-- se invocan por el mecanismo de triggers (contexto del owner), nunca por llamada
-- directa. Revocar EXECUTE a public/anon/authenticated elimina la superficie de
-- invocacion directa sin afectar los triggers. Buena higiene (§3.1 seguridad).
-- IDEMPOTENTE. ROLLBACK: re-grant (no recomendado).
-- ============================================================================

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.audit_user_role_change() from public, anon, authenticated;

-- ROLLBACK:
--   grant execute on function public.handle_new_user() to authenticated;
--   grant execute on function public.audit_user_role_change() to authenticated;
