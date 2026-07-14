-- 0095 — Fase Evolucion 1.5: scorecard de proveedores (senales reales, agregadas).
-- Da al Gerente de Evolucion (y a quien tenga vendor.read) una vista de supervision de
-- proveedores por senales OBJETIVAS ya existentes: criticidad, estado, vencimiento de contrato,
-- sistemas provistos (CMDB), incidencias sobre esos sistemas, alertas de monitoreo y disputas.
-- SECURITY DEFINER + gate vendor.read + scope tenant: agrega sin depender de la RLS por-fila de
-- monitoring_alert/dispute_case. NO expone filas individuales, solo conteos por proveedor.
-- "Abierto" = resolved_at is null (semantica generica y estable en ambas tablas).

create or replace function public.vendor_scorecard()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_tenant uuid := public.current_tenant_id();
  r jsonb;
begin
  if not public.has_permission('vendor.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_tenant is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.criticality_rank desc, s.open_incidents desc, s.days_to_expiry asc nulls last), '[]'::jsonb)
  into r
  from (
    select
      v.id, v.code, v.name, v.category, v.criticality, v.status,
      v.contract_end,
      case v.criticality when 'critical' then 4 when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end as criticality_rank,
      case when v.contract_end is null then null else (v.contract_end - current_date) end as days_to_expiry,
      (select count(*) from configuration_item ci where ci.vendor_id = v.id) as systems,
      (select count(*) from incident i
         where i.affected_ci_id in (select ci.id from configuration_item ci where ci.vendor_id = v.id)
           and i.status not in ('resolved','closed','cancelled')) as open_incidents,
      (select count(*) from incident i
         where i.affected_ci_id in (select ci.id from configuration_item ci where ci.vendor_id = v.id)
           and i.opened_at >= now() - interval '90 days') as incidents_90d,
      (select count(*) from monitoring_alert ma where ma.vendor_id = v.id and ma.resolved_at is null) as open_alerts,
      (select count(*) from dispute_case dc where dc.processor_vendor_id = v.id and dc.resolved_at is null) as open_disputes
    from vendor v
    where v.tenant_id = v_tenant and v.status <> 'deleted'
  ) s;

  return r;
end
$function$;

revoke all on function public.vendor_scorecard() from public;
grant execute on function public.vendor_scorecard() to authenticated;

comment on function public.vendor_scorecard() is
  'Fase Evolucion 1.5: scorecard AGREGADO de proveedores (senales reales por proveedor). Gate vendor.read + scope tenant.';
