-- 0117_my_case_assignee.sql
-- Portal usuario (Fase B3): "Quien atiende" muestra al usuario el nombre del agente asignado.
-- Extiende get_my_case (owner-checked) con assignee (assigned_member_id -> team_member.name).
-- Aditivo y seguro (caso propio). DROP+CREATE por cambio de RETURNS TABLE.

drop function if exists public.get_my_case(uuid);

create or replace function public.get_my_case(p_id uuid)
returns table (
  id uuid, incident_number text, title text, description text, status text, priority text,
  category text, opened_at timestamptz, first_response_at timestamptz, resolved_at timestamptz,
  sla_response_due_at timestamptz, sla_resolution_due_at timestamptz,
  app text, service text, product text, channel text, business_unit text, reporter text, assignee text
)
language sql stable security definer set search_path = public, auth as $$
  select i.id, i.incident_number::text, i.title::text, i.description::text, i.status::text,
         i.priority::text, i.category::text, i.opened_at, i.first_response_at, i.resolved_at,
         i.sla_response_due_at, i.sla_resolution_due_at,
         ci.name::text, sv.name::text, pr.name::text, ch.name::text, bu.name::text,
         coalesce(ua.full_name, ua.username, ua.email)::text, tm.name::text
  from public.incident i
  left join public.configuration_item ci on ci.id = i.affected_ci_id
  left join public.service sv on sv.id = i.affected_service_id
  left join public.product pr on pr.id = i.affected_product_id
  left join public.channel ch on ch.id = i.affected_channel_id
  left join public.business_unit bu on bu.id = i.affected_business_unit_id
  left join public.user_account ua on ua.id = i.reported_by_user_id
  left join public.team_member tm on tm.id = i.assigned_member_id
  where i.id = p_id
    and i.reported_by_user_id = public.current_account_id();
$$;
revoke execute on function public.get_my_case(uuid) from public, anon;
grant execute on function public.get_my_case(uuid) to authenticated, service_role;
