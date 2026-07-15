-- 0099 — Fase 1 (dominio-first): tribus + extensiones de squad.
-- Tribu = agrupacion de squads por flujo de valor. Squad extiende para modelar dominio/capacidad,
-- tipo (domain/enabler/transient) y liderazgo (Business Owner, Tech Lead, Agile Lead). Aditivo:
-- no rompe nada. is_transversal se conserva y se mapea a squad_type='enabler'.

-- 1) Tribu (master data): RLS por tenant, soft-delete via record_status, auditoria, codigo unico.
create table if not exists public.tribe (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  code varchar(40) not null,
  name varchar(160) not null,
  mission text,
  value_stream text,
  objective text,
  tribe_lead_user_id uuid,
  status public.record_status not null default 'active',
  version_no bigint not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint tribe_code_len check (btrim(code) <> ''),
  constraint tribe_name_len check (char_length(btrim(name)) >= 3)
);
create unique index if not exists tribe_code_uq on public.tribe (tenant_id, lower(btrim(code))) where status <> 'deleted';
create index if not exists tribe_tenant_idx on public.tribe (tenant_id);

alter table public.tribe enable row level security;
drop policy if exists tribe_isolation on public.tribe;
create policy tribe_isolation on public.tribe using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- 2) Extensiones de squad
alter table public.squad
  add column if not exists tribe_id uuid references public.tribe(id) on delete set null,
  add column if not exists squad_type text not null default 'domain',
  add column if not exists mission text,
  add column if not exists business_owner_user_id uuid,
  add column if not exists tech_lead_user_id uuid,
  add column if not exists agile_lead_user_id uuid,
  add column if not exists handles_run boolean not null default true,
  add column if not exists handles_change boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'squad_type_chk') then
    alter table public.squad add constraint squad_type_chk check (squad_type in ('domain','enabler','transient'));
  end if;
end $$;

create index if not exists squad_tribe_idx on public.squad (tribe_id);

-- Backfill: un squad transversal es, por definicion, un enabler.
update public.squad set squad_type = 'enabler' where is_transversal = true and squad_type = 'domain';

comment on table public.tribe is 'Fase 1: tribu = agrupacion de squads por flujo de valor.';
comment on column public.squad.squad_type is 'domain (dueno de capacidad) | enabler (plataforma/transversal) | transient (temporal).';
