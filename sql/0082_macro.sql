-- 0082_macro.sql
-- Macros / respuestas guardadas (FASE 3.1 pilar 5): texto reutilizable que el operador inserta
-- en un comentario. Decision: COMPARTIDAS a nivel tenant (activo de equipo), administrables como
-- dato maestro en /catalog. RLS por tenant; auditoria + updated_at por trigger.

create table if not exists public.macro (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  code varchar not null,
  name varchar not null,
  body text not null,
  category varchar,
  status public.record_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  version_no bigint not null default 1,
  constraint uq_macro_code unique (tenant_id, code)
);

alter table public.macro enable row level security;

do $$ begin
  if not exists (select 1 from pg_policy where polname = 'macro_isolation') then
    create policy macro_isolation on public.macro
      using (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id());
  end if;
end $$;

drop trigger if exists trg_macro_updated on public.macro;
create trigger trg_macro_updated before update on public.macro
  for each row execute function set_updated_at();

drop trigger if exists trg_audit_macro on public.macro;
create trigger trg_audit_macro after insert or update or delete on public.macro
  for each row execute function audit_row_change();
