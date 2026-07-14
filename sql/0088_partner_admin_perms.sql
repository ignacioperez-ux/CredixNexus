-- 0088_partner_admin_perms.sql
-- UX-017: el rol partner_admin ("Admin partner") estaba inerte (cero permisos). Directiva del
-- arquitecto: acceso TOTAL a modificar, crear y consultar. Se concede CRUD operativo completo.
--
-- EXCLUIDO a proposito (verbos de gobernanza/aprobacion/plataforma, distintos de modificar/crear/
-- consultar; areas sensibles por CLAUDE.md §3/§11 — requieren confirmacion explicita para sumarlos):
--   tenant.manage, user.manage       (admin de plataforma)
--   audit.read, audit.export         (ledger / evidencia de cumplimiento)
--   rule.manage, rule.approve        (editar/publicar reglas de credito — motor sensible)
--   change.approve                   (aprobacion CAB)
--   recommendation.decide            (aprobacion de evolucion)
--   project.deploy                   (autorizar pase a produccion)
--   grc.manage                       (gobierno GRC)
--   agent.execute                    (identidad de agente IA)
-- Nota: la RLS acota todo por tenant; "total" es dentro del tenant del usuario.

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.role r
cross join public.permission p
where r.code = 'partner_admin' and r.tenant_id is null
  and p.code not in (
    'tenant.manage', 'user.manage', 'audit.read', 'audit.export',
    'rule.manage', 'rule.approve', 'change.approve', 'recommendation.decide',
    'project.deploy', 'grc.manage', 'agent.execute'
  )
on conflict do nothing;
