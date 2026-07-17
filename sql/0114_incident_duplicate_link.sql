-- 0114_incident_duplicate_link.sql
-- Fase 3 (parte A): relacion formal duplicado<->duplicado entre casos persistidos.
-- Un caso "duplicado" apunta a su caso "primario" (canonico). Audit-grade: cada alta/cambio se
-- registra en el ledger via trigger generico (actor = auth.uid()). No destructivo: marcar duplicado
-- NO cierra el caso (principio client-centric: nunca perder el hilo). Revocacion = soft (status).
--
-- Deteccion previa: Fase 1 (lexico, lib/incidents/similar.ts) + Fase 2 (IA, refineSimilarAtIntake).
-- Aqui se materializa la DECISION humana (Gerencia) de que dos casos son el mismo problema.

create table if not exists public.incident_duplicate_link (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenant(id),
  duplicate_incident_id  uuid not null references public.incident(id),
  primary_incident_id    uuid not null references public.incident(id),
  source                 varchar not null default 'manual',
  confidence             numeric,
  reason                 text,
  status                 varchar not null default 'active',
  created_by             uuid references public.user_account(id),
  created_at             timestamptz not null default now(),
  revoked_by             uuid references public.user_account(id),
  revoked_at             timestamptz,
  updated_at             timestamptz not null default now(),
  constraint chk_dup_not_self       check (duplicate_incident_id <> primary_incident_id),
  constraint chk_dup_source         check (source in ('manual','ai','lexical')),
  constraint chk_dup_status         check (status in ('active','revoked')),
  constraint chk_dup_confidence     check (confidence is null or (confidence >= 0 and confidence <= 100))
);

-- Un caso es duplicado ACTIVO de a lo sumo UN canonico (unicidad funcional, §10.4).
create unique index if not exists uq_incident_duplicate_active
  on public.incident_duplicate_link (tenant_id, duplicate_incident_id)
  where status = 'active';

-- Lookups por canonico y por duplicado.
create index if not exists idx_dup_primary
  on public.incident_duplicate_link (tenant_id, primary_incident_id, status);
create index if not exists idx_dup_duplicate
  on public.incident_duplicate_link (tenant_id, duplicate_incident_id, status);

-- updated_at automatico.
drop trigger if exists trg_incident_duplicate_link_updated on public.incident_duplicate_link;
create trigger trg_incident_duplicate_link_updated before update on public.incident_duplicate_link
  for each row execute function public.set_updated_at();

-- Audit-grade (§11): toda mutacion al ledger inmutable (actor = auth.uid()). Si el ledger falla,
-- la transaccion se revierte.
drop trigger if exists trg_audit_incident_duplicate_link on public.incident_duplicate_link;
create trigger trg_audit_incident_duplicate_link after insert or update or delete on public.incident_duplicate_link
  for each row execute function public.audit_row_change();

-- RLS por tenant (§3.2 #3).
alter table public.incident_duplicate_link enable row level security;
drop policy if exists incident_duplicate_link_isolation on public.incident_duplicate_link;
create policy incident_duplicate_link_isolation on public.incident_duplicate_link for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

comment on table public.incident_duplicate_link is
  'Enlace duplicado->primario entre incidentes (decision humana de Gerencia). Audit-grade, no destructivo, revocable (status).';
