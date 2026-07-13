-- 0078_manager_cross_visibility.sql
-- Visibilidad cruzada de gerencias (FASE 2): tanto la Gerencia de Operaciones como la de
-- Evolucion/TI deben VER todo tipo de incidentes, mejoras (problemas) y proyectos.
--
-- Estado previo (verificado):
--   support_lead  (Gte. Operaciones): tenia incident/major/problem/change/squad; FALTABA project.read.
--   product_owner (Gte. Evolucion/TI): tenia incident/change/project/squad; FALTABAN problem.read y major_incident.read.
--
-- Solo lectura (el usuario pidio "ver"). Roles/permisos son globales (tenant_id null).
-- Idempotente por PK (role_id, permission_id). No revoca nada.

insert into public.role_permission (role_id, permission_id)
select ro.id, p.id
from (values
  ('support_lead',  'project.read'),
  ('product_owner', 'problem.read'),
  ('product_owner', 'major_incident.read')
) x(role_code, perm_code)
join public.role ro on ro.code = x.role_code
join public.permission p on p.code = x.perm_code
on conflict (role_id, permission_id) do nothing;
