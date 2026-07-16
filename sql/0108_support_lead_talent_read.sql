-- 0108 — El Gerente de Operaciones (support_lead) debe ver "Desempeno" (evaluaciones/efectividad
-- de agentes) en su persona (OPERATIONS_NAV, bloque "Equipo de atencion"). Esa pantalla (/talent)
-- esta gateada por talent.read, permiso que support_lead no tenia. Se otorga SOLO lectura
-- (talent.read), NO talent.manage: puede consultar el desempeno del equipo pero no administrar
-- talento/staffing (eso sigue siendo de Evolucion/People-lead). Grant idempotente, solo datos:
-- no cambia RLS ni has_permission. La segregacion dura del rol (no ver Proyectos/Squads/Reglas/AI)
-- es de capa de aplicacion (ROLE_ROUTE_DENY en lib/nav/access.ts + guard del layout).

insert into role_permission (role_id, permission_id)
select r.id, p.id
from role r cross join permission p
where r.code = 'support_lead' and p.code = 'talent.read'
  and not exists (select 1 from role_permission rp where rp.role_id = r.id and rp.permission_id = p.id);
