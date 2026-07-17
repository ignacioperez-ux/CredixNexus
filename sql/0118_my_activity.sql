-- 0118_my_activity.sql
-- Portal usuario (Fase C2): "Actividad reciente" del usuario = ultimas actualizaciones NO internas
-- en SUS propios casos (respuestas de la mesa/sistema + las suyas). RPC SECURITY DEFINER owner-checked
-- (reported_by_user_id = current_account_id()); nunca notas internas del agente. Solo lectura.

create or replace function public.get_my_activity(p_limit int default 12)
returns table (
  incident_id uuid, incident_number text, title text, body text,
  is_mine boolean, is_system boolean, created_at timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  select c.incident_id, i.incident_number::text, i.title::text, c.body::text,
         (c.author_user_id = public.current_account_id()) as is_mine,
         c.is_system_generated as is_system,
         c.created_at
  from public.incident_comment c
  join public.incident i on i.id = c.incident_id
  where i.reported_by_user_id = public.current_account_id()
    and coalesce(c.visibility, 'partner') <> 'internal'
  order by c.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;
revoke execute on function public.get_my_activity(int) from public, anon;
grant execute on function public.get_my_activity(int) to authenticated, service_role;
