-- 0081_saved_view.sql
-- Vistas guardadas por usuario (FASE 3.1 pilar 5): un usuario persiste su combinacion de
-- filtros para un modulo (scope) y la recarga con un click.
--
-- Convencion del repo: RLS = aislamiento por tenant; el scope PER-USER se aplica en la capa
-- app (queries filtran por user_id = cuenta actual), igual que knowledge_feedback/comentarios.
-- Auditoria por trigger (audit_row_change) + updated_at (set_updated_at).

create table if not exists public.saved_view (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  user_id uuid not null references public.user_account(id),
  scope varchar not null,                       -- modulo, ej. 'incidents'
  name varchar not null,
  filters jsonb not null default '{}'::jsonb,   -- combinacion de filtros del modulo
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint uq_saved_view unique (tenant_id, user_id, scope, name)
);

alter table public.saved_view enable row level security;

do $$ begin
  if not exists (select 1 from pg_policy where polname = 'saved_view_isolation') then
    create policy saved_view_isolation on public.saved_view
      using (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id());
  end if;
end $$;

drop trigger if exists trg_saved_view_updated on public.saved_view;
create trigger trg_saved_view_updated before update on public.saved_view
  for each row execute function set_updated_at();

drop trigger if exists trg_audit_saved_view on public.saved_view;
create trigger trg_audit_saved_view after insert or update or delete on public.saved_view
  for each row execute function audit_row_change();
