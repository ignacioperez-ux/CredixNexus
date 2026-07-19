-- 0127_get_my_case_recurrence.sql
-- Amplia get_my_case para exponer el flag de reincidencia (y el numero del caso previo) al portal,
-- de modo que el REPORTANTE pueda ver y cambiar el check en su propio caso. SECURITY DEFINER
-- acotado al reportante (igual que antes). Requiere drop por cambio de tipo de retorno.

drop function if exists public.get_my_case(uuid);

create or replace function public.get_my_case(p_id uuid)
returns table(
  id uuid, incident_number text, title text, description text, status text, priority text,
  category text, opened_at timestamptz, first_response_at timestamptz, resolved_at timestamptz,
  sla_response_due_at timestamptz, sla_resolution_due_at timestamptz,
  app text, service text, product text, channel text, business_unit text, reporter text, assignee text,
  is_recurrence boolean, recurrence_of_number text
)
language sql stable security definer
set search_path to 'public', 'auth'
as $function$
  select i.id, i.incident_number::text, i.title::text, i.description::text, i.status::text,
         i.priority::text, i.category::text, i.opened_at, i.first_response_at, i.resolved_at,
         i.sla_response_due_at, i.sla_resolution_due_at,
         ci.name::text, sv.name::text, pr.name::text, ch.name::text, bu.name::text,
         coalesce(ua.full_name, ua.username, ua.email)::text, tm.name::text,
         coalesce(i.is_recurrence, false), rof.incident_number::text
  from public.incident i
  left join public.configuration_item ci on ci.id = i.affected_ci_id
  left join public.service sv on sv.id = i.affected_service_id
  left join public.product pr on pr.id = i.affected_product_id
  left join public.channel ch on ch.id = i.affected_channel_id
  left join public.business_unit bu on bu.id = i.affected_business_unit_id
  left join public.user_account ua on ua.id = i.reported_by_user_id
  left join public.team_member tm on tm.id = i.assigned_member_id
  left join public.incident rof on rof.id = i.recurrence_of_incident_id
  where i.id = p_id
    and i.reported_by_user_id = public.current_account_id();
$function$;
