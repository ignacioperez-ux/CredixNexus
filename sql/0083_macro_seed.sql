-- 0083_macro_seed.sql
-- Semilla de macros/respuestas estandar de mesa (contenido operativo real, no mock).
-- Idempotente por (tenant_id, code). Tenant resuelto desde los datos existentes.

do $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.configuration_item group by tenant_id order by count(*) desc limit 1;
  if v_tenant is null then return; end if;

  insert into public.macro (tenant_id, code, name, category, body)
  select v_tenant, x.code, x.name, 'atencion', x.body
  from (values
    ('ACK', 'Acuse de recibo', 'Hemos recibido tu caso y ya esta en atencion. Te mantendremos informado del avance.'),
    ('INFO', 'Solicitud de informacion', 'Para avanzar necesitamos la siguiente informacion: [detallar]. Quedamos atentos a tu respuesta.'),
    ('WIP', 'En progreso', 'Tu caso esta en analisis por el equipo. Te actualizaremos apenas tengamos novedades.'),
    ('RESOLVED', 'Resolucion', 'Tu caso ha sido resuelto. Si el inconveniente persiste, responde a este mensaje y lo reabrimos.')
  ) x(code, name, body)
  on conflict (tenant_id, code) do nothing;
end $$;
