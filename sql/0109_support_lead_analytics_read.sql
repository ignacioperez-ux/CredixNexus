-- 0109 — El Gerente de Operaciones (support_lead) tiene "Analitica" en su persona (OPERATIONS_NAV,
-- §1): Analitica operativa (/analytics) y Analisis de comportamiento (/analytics/comportamiento).
-- Esas pantallas se alcanzan por incident.read (any-of en la ruta) pero sus RPC (analytics_overview,
-- incident_behavior_analysis, performance_metrics, supervisor_metrics) gatean por analytics.read.
-- support_lead no tenia analytics.read -> el RPC lanzaba 'forbidden' y tumbaba el Server Component
-- (mismo patron que el crash del admin, F10). Se otorga analytics.read (solo lectura de agregados,
-- RLS por tenant). Grant idempotente, solo datos: no cambia RLS ni has_permission.

insert into role_permission (role_id, permission_id)
select r.id, p.id
from role r cross join permission p
where r.code = 'support_lead' and p.code = 'analytics.read'
  and not exists (select 1 from role_permission rp where rp.role_id = r.id and rp.permission_id = p.id);
