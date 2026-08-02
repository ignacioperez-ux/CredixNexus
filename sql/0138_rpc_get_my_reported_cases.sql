-- ============================================================================
-- Credix Nexus — 0138 — RPC get_my_reported_cases (cierra regresion menor de P0)
-- ----------------------------------------------------------------------------
-- Tras 0135 (RLS por dueno), user_account quedo owner-scoped para el partner externo:
-- en el LISTADO del portal el nombre del asignado (staff) salia null porque el embed
-- `assignee:assigned_user_id(full_name)` no puede leer la fila de user_account del staff.
-- Mostrar "quien atiende tu caso" al cliente es el principio rector (tracking client-centric).
--
-- Solucion (mismo patron que get_my_case / get_my_activity): RPC SECURITY DEFINER que
-- devuelve SOLO los casos reportados por el usuario actual (current_account_id) con el
-- nombre del asignado resuelto por el definer. No expone datos de terceros: filtra por
-- reported_by_user_id = current_account_id() y tenant. Reemplaza el query directo del
-- portal. Para internos el resultado es identico (sus casos reportados).
--
-- P2-consistente: revoke execute a anon/public + grant a authenticated/service_role
-- (una funcion nueva recibe por defecto EXECUTE a anon en Supabase; hay que cerrarlo).
-- IDEMPOTENTE. Reversible (drop function al pie).
-- ============================================================================

create or replace function public.get_my_reported_cases(p_limit int default 20)
 returns table (
   id uuid,
   incident_number text,
   title text,
   status text,
   opened_at timestamptz,
   priority text,
   sla_resolution_due_at timestamptz,
   first_response_at timestamptz,
   resolved_at timestamptz,
   case_type text,
   updated_at timestamptz,
   survey_status text,
   assignee_name text
 )
 language sql
 stable
 security definer
 set search_path to 'public', 'auth'
as $function$
  select
    i.id,
    i.incident_number::text,
    i.title::text,
    i.status::text,
    i.opened_at,
    i.priority::text,
    i.sla_resolution_due_at,
    i.first_response_at,
    i.resolved_at,
    i.case_type::text,
    i.updated_at,
    (select cs.status::text from public.case_survey cs where cs.incident_id = i.id limit 1) as survey_status,
    ua.full_name as assignee_name
  from public.incident i
  left join public.user_account ua on ua.id = i.assigned_user_id
  where i.reported_by_user_id = current_account_id()
    and i.tenant_id = current_tenant_id()
  order by i.opened_at desc
  limit greatest(coalesce(p_limit, 20), 1);
$function$;

comment on function public.get_my_reported_cases(int) is
  'Casos reportados por el usuario actual (current_account_id) con nombre del asignado resuelto por el definer. Portal "Mis casos"; no expone datos de terceros.';

revoke execute on function public.get_my_reported_cases(int) from anon, public;
grant  execute on function public.get_my_reported_cases(int) to authenticated, service_role;

-- =============================================================================
-- ROLLBACK: drop function if exists public.get_my_reported_cases(int);
-- =============================================================================
