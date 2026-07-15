-- 0101 — Fase 2 (Iniciativa 360): blockers, riesgos y dependencias por iniciativa.
-- Un solo objeto con `kind` para no multiplicar tablas: blocker (bloqueo activo), risk (riesgo),
-- dependency (depende de otro squad -> related_squad_id). Alimenta el indicador de salud de la
-- iniciativa. RLS por tenant, checks de enum, auditoria.

create table if not exists public.project_risk (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null references public.project(id) on delete cascade,
  kind text not null default 'risk' check (kind in ('blocker','risk','dependency')),
  title varchar(200) not null,
  description text,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','mitigating','resolved')),
  owner_user_id uuid,
  related_squad_id uuid references public.squad(id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint project_risk_title_len check (char_length(btrim(title)) >= 3)
);
create index if not exists project_risk_project_idx on public.project_risk (project_id, status);

alter table public.project_risk enable row level security;
drop policy if exists project_risk_isolation on public.project_risk;
create policy project_risk_isolation on public.project_risk using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

comment on table public.project_risk is 'Fase 2: blockers/riesgos/dependencias de la iniciativa (Iniciativa 360).';
