-- 0079_mejoras_responsibility_evolution.sql
-- Responsabilidad de MEJORAS (problemas) = Gerencia de Evolucion/TI, NO Operaciones (FASE 2).
--
-- Correccion de una inversion detectada:
--   support_lead  (Operaciones) TENIA problem.manage  -> gestionaba mejoras (incorrecto).
--   product_owner (Evolucion/TI) NO tenia problem.manage -> no podia gestionarlas (incorrecto).
--
-- Regla: ambos GERENTES pueden VER mejoras (problem.read se conserva en los dos), pero solo
-- Evolucion las GESTIONA. Roles/permisos son globales (tenant_id null).
-- Autorizado explicitamente por el arquitecto.

-- 1) Evolucion pasa a gestionar mejoras (idempotente).
insert into public.role_permission (role_id, permission_id)
select ro.id, p.id
from public.role ro, public.permission p
where ro.code = 'product_owner' and p.code = 'problem.manage'
on conflict (role_id, permission_id) do nothing;

-- 2) Operaciones deja de gestionar mejoras (conserva problem.read para verlas).
delete from public.role_permission rp
using public.role ro, public.permission p
where rp.role_id = ro.id and rp.permission_id = p.id
  and ro.code = 'support_lead' and p.code = 'problem.manage';
