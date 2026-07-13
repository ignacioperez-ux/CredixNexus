-- 0080_operations_manages_incidents.sql
-- Responsabilidad de INCIDENCIAS = Gerencia de Operaciones; Evolucion NO las gestiona (FASE 2).
--
-- Regla (matriz de responsabilidad):
--   Operaciones (support_lead): GESTIONA incidencias (crear/actualizar/asignar/resolver/triage)
--                               y SLA. Solo VE mejoras y proyectos.
--   Evolucion  (product_owner): GESTIONA mejoras (problemas) y proyectos. Solo VE incidencias.
--
-- Estado previo: support_lead tenia incident.resolve + triage.manage, pero le faltaban
-- incident.create / incident.update / incident.assign para gestionar de punta a punta.
-- product_owner ya estaba correcto: solo incident.read (no gestiona incidencias) -> sin cambios.
--
-- Solo se AGREGAN grants a Operaciones (idempotente). No se revoca nada. Permisos globales.

insert into public.role_permission (role_id, permission_id)
select ro.id, p.id
from (values
  ('support_lead', 'incident.create'),
  ('support_lead', 'incident.update'),
  ('support_lead', 'incident.assign')
) x(role_code, perm_code)
join public.role ro on ro.code = x.role_code
join public.permission p on p.code = x.perm_code
on conflict (role_id, permission_id) do nothing;
