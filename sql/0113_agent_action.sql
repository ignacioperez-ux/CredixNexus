-- 0113_agent_action.sql
-- Reconciliacion: la tabla public.agent_action existia SOLO en Supabase (creada fuera de
-- control de versiones). Esta migracion la formaliza EXACTAMENTE como esta en produccion,
-- para que un entorno limpio reproduzca el esquema. Idempotente: no altera la tabla real
-- (create ... if not exists) y recrea la policy de forma segura.
--
-- Gobierno IA (CLAUDE.md §11): registro append-only de toda accion de agente (prompt/modelo/
-- input/output/confianza/revision humana). La IA SUGIERE, el humano decide.

create table if not exists public.agent_action (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenant(id),
  agent_name            varchar not null,
  agent_version         varchar not null default 'v1',
  model_provider        varchar not null,
  model_name            varchar not null,
  requested_by_user_id  uuid references public.user_account(id),
  related_entity_type   varchar,
  related_entity_id     uuid,
  action_type           varchar not null,
  input_json            jsonb not null default '{}'::jsonb,
  output_json           jsonb not null default '{}'::jsonb,
  prompt_hash           varchar,
  confidence_score      numeric,
  human_review_required boolean not null default true,
  human_reviewed_by     uuid references public.user_account(id),
  human_reviewed_at     timestamptz,
  status                varchar not null default 'completed',
  created_at            timestamptz not null default now(),
  constraint chk_agent_confidence
    check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1))
);

-- Indice de consulta por entidad relacionada (espeja el real).
create index if not exists idx_agent_action_entity
  on public.agent_action using btree (tenant_id, related_entity_type, related_entity_id, created_at desc);

-- RLS por tenant (§3.2 #3). Recreacion idempotente de la policy.
alter table public.agent_action enable row level security;
drop policy if exists agent_action_isolation on public.agent_action;
create policy agent_action_isolation on public.agent_action for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
