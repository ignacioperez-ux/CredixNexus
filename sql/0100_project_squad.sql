-- 0100 — Fase 2 (dominio-first): una iniciativa viaja por N squads.
-- Corrige el modelo 1:1 (project.squad_id) a N:N: un squad es LEAD y otros CONTRIBUYEN. Aditivo:
-- project.squad_id se conserva (compat + lead por defecto). initiative_type distingue
-- proyecto/mejora/demanda/run.

alter table public.project
  add column if not exists initiative_type text not null default 'project',
  add column if not exists lead_squad_id uuid references public.squad(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_initiative_type_chk') then
    alter table public.project add constraint project_initiative_type_chk
      check (initiative_type in ('project','improvement','demand','run'));
  end if;
end $$;

create table if not exists public.project_squad (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null references public.project(id) on delete cascade,
  squad_id uuid not null references public.squad(id) on delete cascade,
  role text not null default 'contributing' check (role in ('lead','contributing')),
  allocation_pct integer check (allocation_pct is null or (allocation_pct >= 0 and allocation_pct <= 100)),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint project_squad_uq unique (project_id, squad_id)
);
create index if not exists project_squad_project_idx on public.project_squad (project_id);
create index if not exists project_squad_squad_idx on public.project_squad (squad_id);

alter table public.project_squad enable row level security;
drop policy if exists project_squad_isolation on public.project_squad;
create policy project_squad_isolation on public.project_squad using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- Backfill: el squad actual del proyecto pasa a ser LEAD; se fija lead_squad_id e initiative_type.
insert into public.project_squad (tenant_id, project_id, squad_id, role)
select p.tenant_id, p.id, p.squad_id, 'lead'
from public.project p
where p.squad_id is not null
on conflict (project_id, squad_id) do nothing;

update public.project set lead_squad_id = squad_id where squad_id is not null and lead_squad_id is null;
update public.project set initiative_type =
  case when project_type ilike '%improvement%' or source_type = 'incident' then 'improvement' else 'project' end
where initiative_type = 'project';

comment on table public.project_squad is 'Fase 2: N:N iniciativa<->squad (lead + contribuyentes).';
comment on column public.project.initiative_type is 'project | improvement | demand | run.';
