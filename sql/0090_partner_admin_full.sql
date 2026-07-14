-- 0090_partner_admin_full.sql
-- Directiva del arquitecto: partner_admin suma el cluster sensible de gobernanza/aprobacion/
-- plataforma (antes excluido en 0088). Con esto partner_admin tiene acceso COMPLETO (63/63),
-- acotado por RLS al tenant del usuario. Incluye areas sensibles (reglas de credito, GRC,
-- auditoria, admin de tenant/usuarios, IA) — concedido explicitamente.

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.role r
join public.permission p on p.code in (
  'tenant.manage', 'user.manage', 'audit.read', 'audit.export',
  'rule.manage', 'rule.approve', 'change.approve', 'recommendation.decide',
  'project.deploy', 'grc.manage', 'agent.execute'
)
where r.code = 'partner_admin' and r.tenant_id is null
on conflict do nothing;
