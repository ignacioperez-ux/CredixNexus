-- 0123_dashboard_counts_cmdb.sql
-- FIX (integridad §10/§11): el inventario de la Torre/Dashboard mostraba Aplicaciones=0 y Sistemas=0
-- porque dashboard_counts filtraba configuration_item por ci_type IN ('application','system'),
-- valores que NO existen en los datos. La CMDB real usa una taxonomia por DOMINIO (core, canal,
-- integracion, infraestructura, plataforma, corporativo, analitica, ...). Era un hardcode de valores
-- inexistentes.
--
-- Solucion: reflejar el CMDB real. Se reemplazan las dos metricas por:
--   'cmdb'         = total de configuration_item (todos los CI del tenant).
--   'integrations' = configuration_item con ci_type='integracion'.
-- (processes/products/ledger sin cambios.) La funcion sigue SIN SECURITY DEFINER -> RLS acota por tenant.
--
-- ROLLBACK: restaurar la version previa (apps=ci_type='application', systems=ci_type='system').

create or replace function public.dashboard_counts()
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'cmdb',         (select count(*) from public.configuration_item),
    'integrations', (select count(*) from public.configuration_item where ci_type = 'integracion'),
    'processes',    (select count(*) from public.process),
    'products',     (select count(*) from public.product),
    'ledger',       (select count(*) from public.immutable_audit_event)
  );
$function$;
