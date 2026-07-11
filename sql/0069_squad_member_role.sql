-- 0069_squad_member_role.sql
-- Rol squad_member (miembro de squad): ve backlog y proyectos asignados. Global (tenant null),
-- como el resto del catalogo de roles. Completa el modelo RBAC para la experiencia por rol.

insert into public.role (code, name, description, tenant_id)
select 'squad_member', 'Miembro de Squad', 'Miembro de squad: backlog y proyectos asignados', null
where not exists (select 1 from public.role where code='squad_member' and tenant_id is null);

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.role r
join public.permission p on p.code in ('squad.read', 'project.read')
where r.code = 'squad_member' and r.tenant_id is null
on conflict do nothing;
