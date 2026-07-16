-- 0112 — El Operador (support_agent) ejecuta SOLO sus casos asignados; no admite, no asigna, no
-- gestiona disputas/observabilidad, no cambia prioridad ni edita/cancela casos. Se le retiran los
-- permisos de GESTION que hoy tiene de mas. La regla de oro (mutar solo casos propios) se aplica
-- ademas en la capa de aplicacion (lib/auth/incident-authz). Conserva: incident.read/create/update
-- (acotado a casos propios), worklog.manage, knowledge.read/feedback, service_catalog.read/request,
-- survey.submit, sla.read, major_incident.read, problem.read, etc. (lectura/creacion propia).
-- Solo datos: no toca RLS ni la maquina de estados. Idempotente.

delete from role_permission rp
using role r, permission p
where rp.role_id = r.id and rp.permission_id = p.id
  and r.code = 'support_agent'
  and p.code in ('triage.manage', 'incident.assign', 'dispute.manage', 'observability.manage');
