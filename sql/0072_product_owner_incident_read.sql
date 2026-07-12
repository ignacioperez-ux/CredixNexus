-- 0072_product_owner_incident_read.sql
-- Otorga incident.read al rol product_owner (squad de Evolucion).
--
-- Motivo (CLAUDE.md, principio no negociable): cuando una incidencia genera un cambio
-- importante y pasa al squad de Evolucion, la mesa de ayuda nunca pierde el control del
-- tracking/comunicacion con el cliente. Para eso Evolucion debe poder VER el dashboard y
-- todos los casos abiertos (RLS sigue limitando por tenant_id). Sin incident.read caia en
-- /unauthorized al aterrizar en /dashboard.
--
-- Idempotente: solo inserta si falta y solo audita si hubo cambio real.
-- role y permission son globales (tenant_id null); el evento de ledger se ancla al tenant CORE.

do $$
declare
  v_role uuid;
  v_perm uuid;
  v_ins  int;
begin
  select id into v_role from public.role       where code = 'product_owner';
  select id into v_perm from public.permission where code = 'incident.read';
  if v_role is null or v_perm is null then
    raise exception 'role o permission inexistente (product_owner / incident.read)';
  end if;

  insert into public.role_permission(role_id, permission_id)
  select v_role, v_perm
  where not exists (
    select 1 from public.role_permission where role_id = v_role and permission_id = v_perm
  );
  get diagnostics v_ins = row_count;

  if v_ins > 0 then
    perform public.append_audit_event(
      'c5d2f057-6262-4275-8ba9-16d9617ce128'::uuid,   -- tenant CORE
      'system'::actor_type, null,
      'role.permission_granted', 'role', v_role,
      jsonb_build_object(
        'role', 'product_owner',
        'permission', 'incident.read',
        'motivo', 'evolucion debe ver dashboard y casos abiertos (todos)'
      ),
      null, null, null, null, null
    );
  end if;
end $$;
