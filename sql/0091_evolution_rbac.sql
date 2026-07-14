-- 0091_evolution_rbac.sql
-- Sub-Fase 1.1 del rediseno del rol Gerente de Evolucion (product_owner). Segregacion RBAC:
--   - Nuevos permisos granulares para desacoplar de incident.read: ai.read, analytics.read.
--   - Se otorga a product_owner el SET DE SU MANDATO (squads/talento/CAB/pase a produccion/scorecard/
--     conocimiento/AI/analitica).
--   - Se REVOCA incident.read (deja de ver operacion diaria: dashboard/workspace/incidents/customers)
--     y problem.manage (edicion de problemas queda en Operaciones; el rol solo lee/vincula).
-- Lo retirado del rol sigue existiendo en el rol correcto (Operaciones/Admin) — R1.

insert into public.permission (code, resource, action, description) values
  ('ai.read',        'ai',        'read', 'Ver el AI Center (gobierno de agentes IA)'),
  ('analytics.read', 'analytics', 'read', 'Ver analitica ejecutiva y reportes')
on conflict (code) do nothing;

-- Otorgar el mandato + permisos granulares al Gerente de Evolucion.
insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.role r
join public.permission p on p.code in (
  'ai.read', 'analytics.read',
  'squad.manage', 'talent.read', 'talent.manage',
  'knowledge.read', 'change.approve', 'project.deploy', 'vendor.manage'
)
where r.code = 'product_owner' and r.tenant_id is null
on conflict do nothing;

-- Revocar operacion diaria y edicion de problemas (segregacion + gobierno).
delete from public.role_permission rp
using public.role r, public.permission p
where rp.role_id = r.id and rp.permission_id = p.id
  and r.code = 'product_owner' and r.tenant_id is null
  and p.code in ('incident.read', 'problem.manage');
