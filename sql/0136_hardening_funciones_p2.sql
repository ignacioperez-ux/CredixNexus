-- ============================================================================
-- Credix Nexus — 0136 — Hardening de funciones [P2 de la validacion gstack]
-- ----------------------------------------------------------------------------
-- Remedia dos familias de WARN del linter de seguridad de Supabase:
--
--   A) function_search_path_mutable (x7): funciones sin search_path fijo. Un caller
--      podria manipular search_path para resolver nombres a objetos hostiles. Se fija
--      search_path = public (pg_catalog queda implicito primero). Son SECURITY INVOKER;
--      el hardening aplica igual. No cambia el cuerpo, solo el atributo (ALTER FUNCTION).
--
--   B) anon_security_definer_function_executable (x21): el rol anon (sin login) podia
--      ejecutar RPCs SECURITY DEFINER via PostgREST. Verificado en el codigo: NINGUNA
--      RPC se llama pre-login (el flujo federado request_access_federated corre como
--      authenticated: lee el email del token y luego cierra sesion). Se revoca EXECUTE
--      a anon sobre TODAS las funciones de public (anon no debe ejecutar ninguna). Las
--      funciones no-definer corren como invoker => RLS ya las protege; esto cierra las
--      definer. Reversible (grant al pie).
--
-- No toca las funciones ejecutables por authenticated (get_my_case, submit_case_csat,
-- my_access, etc.): son intencionales para el portal. IDEMPOTENTE.
-- ============================================================================

-- ---- A) search_path fijo (7 funciones) ----
alter function public.derive_priority(impact_level, urgency_level) set search_path = public;
alter function public.set_incident_number()   set search_path = public;
alter function public.set_article_number()    set search_path = public;
alter function public.set_project_number()    set search_path = public;
alter function public.set_risk_event_number() set search_path = public;
alter function public.set_fraud_number()      set search_path = public;
alter function public.set_dispute_number()    set search_path = public;

-- ---- B) anon no ejecuta ninguna funcion de public ----
revoke execute on all functions in schema public from anon;

-- =============================================================================
-- ROLLBACK:
--   -- A) alter function ... reset search_path;  (por cada una)
--   -- B) grant execute on all functions in schema public to anon;
-- =============================================================================
