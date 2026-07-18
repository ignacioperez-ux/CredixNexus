-- 0120_purge_seed_notifications.sql
-- LIMPIEZA: la tabla notification arrastraba una serie SINTETICA de datos seed/demo:
-- 6 notificaciones por dia (17-jun-2026 a 16-jul-2026), todas con link NULL y tipos
-- genericos (general, project_update, sla_breach, incident_assigned, case_escalated,
-- comment_added). Ensuciaban la campanita (55 no leidas de ruido) y, al no tener link,
-- producian "clicks muertos". No son eventos reales de negocio.
--
-- Criterio (seguro): las notificaciones reales SIEMPRE llevan link (todos los callers de
-- notify_role pasan p_link). Las seed son exactamente las de link NULL previas al 17-jul-2026.
-- notification es tabla HOJA (sin FKs entrantes) y NO es el ledger audit-grade
-- (immutable_audit_event); su borrado fisico es seguro y no viola inmutabilidad.
--
-- Idempotente: si ya se corrio (o en un ambiente limpio), no borra nada.

delete from public.notification
where link is null
  and created_at < '2026-07-17';
