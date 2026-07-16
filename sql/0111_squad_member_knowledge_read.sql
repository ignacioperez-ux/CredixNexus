-- 0111 — El Miembro de Squad tiene "Base de conocimiento (lectura)" en su persona (SQUAD_MEMBER_NAV,
-- §2 Ayuda). /knowledge gatea por knowledge.read, permiso que squad_member no tenia (solo tenia
-- project.read y squad.read). Se otorga knowledge.read (solo lectura). Grant idempotente, solo
-- datos: no cambia RLS ni has_permission. La segregacion dura del rol es de capa de aplicacion
-- (ROLE_ROUTE_DENY en lib/nav/access.ts + guard del layout + RPCs acotados a la persona).

insert into role_permission (role_id, permission_id)
select r.id, p.id
from role r cross join permission p
where r.code = 'squad_member' and p.code = 'knowledge.read'
  and not exists (select 1 from role_permission rp where rp.role_id = r.id and rp.permission_id = p.id);
