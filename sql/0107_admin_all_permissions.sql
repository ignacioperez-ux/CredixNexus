-- 0107 — El admin debe tener OPCION A TODO. has_permission() es puro grant-based (sin bypass de
-- admin), y migraciones posteriores agregaron permisos (ai.read, analytics.read) sin otorgarlos a
-- los roles admin. Resultado: RPCs gateados por esos permisos lanzaban 'forbidden' para el admin
-- (system_admin), y la Torre de Control / Analitica / AI Center crasheaban ("saca del app").
--
-- Correccion idempotente y AUTO-REPARABLE: system_admin recibe TODOS los permisos (al re-aplicar,
-- cubre gaps presentes y futuros). tenant_admin suma la lectura de analitica y AI (el app ya lo
-- trata como admin y muestra esos menus). Solo datos: no cambia RLS ni la funcion has_permission.

-- system_admin = todos los permisos
insert into role_permission (role_id, permission_id)
select r.id, p.id
from role r cross join permission p
where r.code = 'system_admin'
  and not exists (select 1 from role_permission rp where rp.role_id = r.id and rp.permission_id = p.id);

-- tenant_admin = suma lectura de analitica y AI
insert into role_permission (role_id, permission_id)
select r.id, p.id
from role r cross join permission p
where r.code = 'tenant_admin' and p.code in ('analytics.read', 'ai.read')
  and not exists (select 1 from role_permission rp where rp.role_id = r.id and rp.permission_id = p.id);
