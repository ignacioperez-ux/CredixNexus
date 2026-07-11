-- 0061_kb_harden.sql
-- Endurecimiento: las funciones de trigger de contadores KB son SECURITY DEFINER (para
-- mantener los contadores sin depender del privilegio UPDATE del rol que califica). No deben
-- ser invocables por RPC. Revocamos EXECUTE a anon/authenticated; el trigger sigue disparando
-- (la ejecucion del trigger no depende del grant EXECUTE al rol de la sesion).

revoke execute on function public.kb_refresh_feedback_counts() from anon, authenticated;
revoke execute on function public.kb_bump_event_counts() from anon, authenticated;
