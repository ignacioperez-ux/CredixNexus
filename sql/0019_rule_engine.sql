-- ============================================================================
-- Credix Nexus — 0019 — Motor de Reglas & Scoring + Recomendaciones + Gobernanza
-- El motor evalua incidentes (explicable, versionado, configurable) y recomienda.
-- El AREA DE NEGOCIO decide y prioriza lo que va a Evolucion (COBIT: control humano).
-- Todo acompanado de gobernanza (politicas/normas/procedimientos/procesos/controles).
-- ============================================================================

do $$ begin
  create type governance_type as enum ('policy','norm','procedure','process','control');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recommendation_status as enum ('pending','approved','rejected','deferred','converted');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------- rule ----
create table if not exists public.rule (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid null references public.tenant(id),   -- null = global
    code          varchar(100) not null,
    name          varchar(250) not null,
    rule_type     rule_type not null,
    status        record_status not null default 'draft',
    description   text null,
    owner_user_id uuid null references public.user_account(id),
    created_at    timestamptz not null default now(),
    created_by    uuid null,
    updated_at    timestamptz not null default now(),
    updated_by    uuid null,
    version_no    bigint not null default 1
);
create unique index if not exists uq_rule_code_tenant on public.rule (tenant_id, code) where tenant_id is not null;
create unique index if not exists uq_rule_code_global on public.rule (code) where tenant_id is null;

-- -------------------------------------------------------------- rule_version ----
create table if not exists public.rule_version (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid null references public.tenant(id),
    rule_id        uuid not null references public.rule(id) on delete cascade,
    version_number integer not null,
    status         varchar(40) not null default 'draft',   -- draft|published|archived
    expression_json jsonb not null default '{}'::jsonb,     -- parametros de normalizacion
    weights_json    jsonb not null default '{}'::jsonb,     -- factor -> peso (suman 1.0)
    thresholds_json jsonb not null default '{}'::jsonb,     -- umbrales de decision
    effective_from timestamptz null,
    effective_to   timestamptz null,
    approved_by    uuid null references public.user_account(id),
    approved_at    timestamptz null,
    created_at     timestamptz not null default now(),
    created_by     uuid null,
    constraint uq_rule_version unique (rule_id, version_number),
    constraint chk_rule_version_dates check (effective_to is null or effective_from is null or effective_to >= effective_from)
);
create index if not exists idx_rule_version_active on public.rule_version (rule_id, status);

-- ------------------------------------------------------------ rule_evaluation ----
create table if not exists public.rule_evaluation (
    id                     uuid primary key default gen_random_uuid(),
    tenant_id              uuid not null references public.tenant(id),
    rule_id                uuid not null references public.rule(id),
    rule_version_id        uuid not null references public.rule_version(id),
    entity_type            varchar(80) not null,
    entity_id              uuid not null,
    evaluation_context     varchar(80) not null default 'incident_created',
    input_json             jsonb not null,
    output_json            jsonb not null,
    score                  numeric(9,4) null,
    decision               varchar(80) not null,
    explanation            text null,
    evaluated_at           timestamptz not null default now(),
    evaluated_by_actor_type actor_type not null default 'system',
    evaluated_by_actor_id  uuid null
);
create index if not exists idx_rule_eval_entity on public.rule_evaluation (tenant_id, entity_type, entity_id, evaluated_at desc);
create index if not exists idx_rule_eval_score on public.rule_evaluation (tenant_id, score desc);

-- ------------------------------------------------------ project_recommendation ----
-- El motor la crea; el AREA DE NEGOCIO la decide y prioriza.
create table if not exists public.project_recommendation (
    id                    uuid primary key default gen_random_uuid(),
    tenant_id             uuid not null references public.tenant(id),
    incident_id           uuid not null references public.incident(id),
    rule_evaluation_id    uuid not null references public.rule_evaluation(id),
    recommendation_status recommendation_status not null default 'pending',
    transformation_score  numeric(9,4) not null,
    recommended_project_type varchar(80) not null,
    recommended_name      varchar(250) not null,
    recommended_business_case jsonb not null default '{}'::jsonb,
    business_priority     integer null,                 -- lo fija el negocio (1 = mas alta)
    reviewed_by           uuid null references public.user_account(id),
    reviewed_at           timestamptz null,
    review_reason         text null,
    created_project_id    uuid null,
    created_at            timestamptz not null default now(),
    constraint chk_reco_score check (transformation_score >= 0 and transformation_score <= 100),
    constraint chk_reco_priority check (business_priority is null or business_priority >= 1)
);
create index if not exists idx_reco_status on public.project_recommendation (tenant_id, recommendation_status, business_priority);
create index if not exists idx_reco_incident on public.project_recommendation (tenant_id, incident_id);

-- ------------------------------------------------------------- governance_item ----
create table if not exists public.governance_item (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenant(id),
    item_type   governance_type not null,
    code        varchar(80) not null,
    name        varchar(250) not null,
    description text null,
    status      record_status not null default 'active',
    metadata    jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now(),
    created_by  uuid null,
    updated_at  timestamptz not null default now(),
    updated_by  uuid null,
    version_no  bigint not null default 1,
    constraint uq_governance_code unique (tenant_id, code)
);

create table if not exists public.governance_link (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenant(id),
    governance_item_id uuid not null references public.governance_item(id) on delete cascade,
    entity_type        varchar(80) not null,
    entity_id          uuid not null,
    created_at         timestamptz not null default now(),
    created_by         uuid null,
    constraint uq_governance_link unique (governance_item_id, entity_type, entity_id)
);
create index if not exists idx_gov_link_entity on public.governance_link (tenant_id, entity_type, entity_id);

-- ---- updated_at + audit ----
drop trigger if exists trg_rule_updated on public.rule;
create trigger trg_rule_updated before update on public.rule for each row execute function public.set_updated_at();
drop trigger if exists trg_gov_updated on public.governance_item;
create trigger trg_gov_updated before update on public.governance_item for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_rule on public.rule;
create trigger trg_audit_rule after insert or update or delete on public.rule for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_rule_eval on public.rule_evaluation;
create trigger trg_audit_rule_eval after insert or update or delete on public.rule_evaluation for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_reco on public.project_recommendation;
create trigger trg_audit_reco after insert or update or delete on public.project_recommendation for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_gov on public.governance_item;
create trigger trg_audit_gov after insert or update or delete on public.governance_item for each row execute function public.audit_row_change();

-- rule_version: audit por tenant (puede ser null en globales); trigger que tolera null tenant
create or replace function public.audit_rule_version_change() returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_tenant uuid; v_payload jsonb; v_actor_type actor_type; v_actor_id uuid; v_entity uuid;
begin
    if tg_op='DELETE' then v_entity:=old.id; v_payload:=jsonb_build_object('before',to_jsonb(old));
      select r.tenant_id into v_tenant from public.rule r where r.id=old.rule_id;
    else v_entity:=new.id;
      if tg_op='UPDATE' then v_payload:=jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new));
      else v_payload:=jsonb_build_object('after',to_jsonb(new)); end if;
      select r.tenant_id into v_tenant from public.rule r where r.id=new.rule_id;
    end if;
    -- Reglas globales (sin tenant) no generan evento de negocio por tenant.
    if v_tenant is null then if tg_op='DELETE' then return old; else return new; end if; end if;
    v_actor_id := coalesce(nullif(current_setting('app.current_actor_id', true), '')::uuid, auth.uid());
    v_actor_type := coalesce(nullif(current_setting('app.current_actor_type', true), '')::actor_type,
      case when auth.uid() is not null then 'user'::actor_type else 'system'::actor_type end);
    perform public.append_audit_event(v_tenant, v_actor_type, v_actor_id,
      'rule_version.'||lower(tg_op), 'rule_version', v_entity, v_payload);
    if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function public.audit_rule_version_change() from public, anon, authenticated;
drop trigger if exists trg_audit_rule_version on public.rule_version;
create trigger trg_audit_rule_version after insert or update or delete on public.rule_version for each row execute function public.audit_rule_version_change();

-- ---- RLS ----
alter table public.rule enable row level security;
drop policy if exists rule_read on public.rule;
create policy rule_read on public.rule for select to authenticated
  using (tenant_id is null or tenant_id = public.current_tenant_id());
drop policy if exists rule_write on public.rule;
create policy rule_write on public.rule for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.rule_version enable row level security;
drop policy if exists rule_version_read on public.rule_version;
create policy rule_version_read on public.rule_version for select to authenticated
  using (exists (select 1 from public.rule r where r.id = rule_id and (r.tenant_id is null or r.tenant_id = public.current_tenant_id())));
drop policy if exists rule_version_write on public.rule_version;
create policy rule_version_write on public.rule_version for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.rule_evaluation enable row level security;
drop policy if exists rule_eval_isolation on public.rule_evaluation;
create policy rule_eval_isolation on public.rule_evaluation for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.project_recommendation enable row level security;
drop policy if exists reco_isolation on public.project_recommendation;
create policy reco_isolation on public.project_recommendation for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.governance_item enable row level security;
drop policy if exists gov_isolation on public.governance_item;
create policy gov_isolation on public.governance_item for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.governance_link enable row level security;
drop policy if exists gov_link_isolation on public.governance_link;
create policy gov_link_isolation on public.governance_link for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
