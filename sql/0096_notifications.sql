-- 0096 — Campanita de notificaciones v1 (eventos entre roles).
-- Bandeja por destinatario. RLS: cada usuario ve/edita SOLO las suyas (por tenant). Los eventos
-- se generan via fan-out SECURITY DEFINER (inserta para otros usuarios, respetando el tenant).
-- v1: derivacion a Evolucion y recomendacion aprobada por RC -> Gerente de Evolucion.

create table if not exists public.notification (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  recipient_user_id uuid not null references public.user_account(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  link text,
  severity text not null default 'info' check (severity in ('info','success','warning','critical')),
  is_read boolean not null default false,
  read_at timestamptz,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists notification_recipient_idx on public.notification (recipient_user_id, is_read, created_at desc);
create index if not exists notification_tenant_idx on public.notification (tenant_id);

alter table public.notification enable row level security;

drop policy if exists notification_select_own on public.notification;
create policy notification_select_own on public.notification
  for select using (recipient_user_id = public.current_account_id() and tenant_id = public.current_tenant_id());

drop policy if exists notification_update_own on public.notification;
create policy notification_update_own on public.notification
  for update using (recipient_user_id = public.current_account_id() and tenant_id = public.current_tenant_id())
  with check (recipient_user_id = public.current_account_id() and tenant_id = public.current_tenant_id());

-- Fan-out: crea una notificacion por cada usuario ACTIVO con el rol destino en el tenant del
-- que llama (nunca cross-tenant), excluyendo al propio actor. Devuelve cuantas creo.
create or replace function public.notify_role(
  p_role_code text,
  p_type text,
  p_title text,
  p_body text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_link text default null,
  p_severity text default 'info'
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant uuid := public.current_tenant_id();
  v_actor uuid := public.current_account_id();
  v_count integer := 0;
begin
  if v_tenant is null then return 0; end if;

  insert into public.notification (tenant_id, recipient_user_id, type, title, body, entity_type, entity_id, link, severity, actor_user_id)
  select v_tenant, rec.rid, p_type, p_title, p_body, p_entity_type, p_entity_id, p_link, coalesce(p_severity,'info'), v_actor
  from (
    select distinct ua.id as rid
    from public.user_account ua
    join public.user_role ur on ur.user_id = ua.id
    join public.role r on r.id = ur.role_id
    where ua.tenant_id = v_tenant
      and r.code = p_role_code
      and (r.tenant_id is null or r.tenant_id = v_tenant)
      and (ur.valid_to is null or ur.valid_to > now())
      and (ur.valid_from is null or ur.valid_from <= now())
      and (v_actor is null or ua.id <> v_actor)
  ) rec;

  get diagnostics v_count = row_count;
  return v_count;
end
$function$;

revoke all on function public.notify_role(text, text, text, text, text, uuid, text, text) from public;
grant execute on function public.notify_role(text, text, text, text, text, uuid, text, text) to authenticated;

comment on table public.notification is 'Campanita v1: bandeja de notificaciones por destinatario (RLS por usuario+tenant).';
comment on function public.notify_role(text, text, text, text, text, uuid, text, text) is 'Fan-out SECURITY DEFINER de notificaciones a los usuarios de un rol en el tenant del actor.';
