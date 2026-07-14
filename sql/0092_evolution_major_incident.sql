-- 0092 — Fase Evolucion 1.2: incidentes mayores accionables por ambas areas.
-- Decision de negocio (arquitecto): un incidente mayor puede ser declarado y comandado por
-- Operaciones O por Evolucion (war-room conjunto). El rol Gerente de Evolucion ya veia el
-- war-room (major_incident.read); ahora tambien puede accionarlo (major_incident.manage).
-- NO altera la segregacion de casos individuales: product_owner sigue sin incident.read/update
-- (los casos NO derivados permanecen intocables; ver 0091).

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.role r
join public.permission p on p.code = 'major_incident.manage'
where r.code = 'product_owner' and r.tenant_id is null
on conflict do nothing;
