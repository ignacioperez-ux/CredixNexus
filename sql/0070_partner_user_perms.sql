-- 0070_partner_user_perms.sql
-- Permisos coherentes para el usuario final (partner_user): puede crear casos, consultar y
-- calificar la base de conocimiento. NO se le da incident.read (no debe ver el dashboard ni la
-- vista de agente; su superficie es el portal de autoservicio). Completa el RBAC del rol.

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.role r
join public.permission p on p.code in ('incident.create', 'knowledge.read', 'knowledge.feedback')
where r.code = 'partner_user' and r.tenant_id is null
on conflict do nothing;
