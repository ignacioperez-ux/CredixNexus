-- ============================================================================
-- Credix Nexus — 0014 — Modulo de Incidentes (F1)
-- incident (pivota sobre la aplicacion afectada), incident_comment,
-- numeracion INC-YYYY-NNNNNN, y mejora del actor de auditoria (auth.uid()).
-- ============================================================================

-- ---- Numeracion documental reutilizable (INC/PRB/CHG/PRJ...) ----
create table if not exists public.document_sequence (
    tenant_id     uuid not null references public.tenant(id),
    doc_type      text not null,
    period        text not null,
    current_value bigint not null default 0,
    primary key (tenant_id, doc_type, period)
);
alter table public.document_sequence enable row level security;
-- Sin policies: solo accesible via next_document_number (security definer) o service_role.

create or replace function public.next_document_number(p_tenant uuid, p_doc_type text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare v bigint; v_period text := to_char(now(), 'YYYY');
begin
    insert into public.document_sequence (tenant_id, doc_type, period, current_value)
    values (p_tenant, p_doc_type, v_period, 1)
    on conflict (tenant_id, doc_type, period)
      do update set current_value = public.document_sequence.current_value + 1
    returning current_value into v;
    return p_prefix || '-' || v_period || '-' || lpad(v::text, 6, '0');
end $$;
revoke execute on function public.next_document_number(uuid, text, text) from public, anon;
grant execute on function public.next_document_number(uuid, text, text) to authenticated, service_role;

-- ---- Derivacion de prioridad desde impacto x urgencia (matriz ITSM) ----
create or replace function public.derive_priority(p_impact impact_level, p_urgency urgency_level)
returns priority_level language sql immutable as $$
  select case
    when p_impact = 'critical' and p_urgency in ('critical','high') then 'p1_critical'
    when p_impact = 'critical' or  p_urgency = 'critical'           then 'p1_critical'
    when p_impact = 'high'     and p_urgency in ('high','critical') then 'p2_high'
    when p_impact = 'high'     or  p_urgency = 'high'               then 'p2_high'
    when p_impact = 'medium'   or  p_urgency = 'medium'             then 'p3_medium'
    else 'p4_low'
  end::priority_level;
$$;

-- ------------------------------------------------------------- incident ----
create table if not exists public.incident (
    id                        uuid primary key default gen_random_uuid(),
    tenant_id                 uuid not null references public.tenant(id),
    incident_number           varchar(40) not null,
    title                     varchar(250) not null,
    description               text not null,
    reported_by_user_id       uuid null references public.user_account(id),
    affected_party_id         uuid null references public.party(id),
    -- Las incidencias giran alrededor de estas dimensiones del negocio:
    affected_ci_id            uuid null references public.configuration_item(id),  -- app/sistema (KEY)
    affected_service_id       uuid null references public.service(id),
    affected_product_id       uuid null references public.product(id),
    affected_process_id       uuid null references public.process(id),
    affected_channel_id       uuid null references public.channel(id),
    affected_business_unit_id uuid null references public.business_unit(id),
    source_channel            varchar(50) not null default 'portal',
    category                  varchar(80) not null,
    subcategory               varchar(80) null,
    impact                    impact_level not null default 'medium',
    urgency                   urgency_level not null default 'medium',
    priority                  priority_level not null default 'p3_medium',
    status                    incident_status not null default 'new',
    financial_impact_estimate numeric(18,2) not null default 0,
    affected_transaction_count integer not null default 0,
    affected_partner_count    integer not null default 0,
    credit_process_impact     varchar(80) null,
    partner_impact            boolean not null default false,
    data_quality_suspected    boolean not null default false,
    security_suspected        boolean not null default false,
    transformation_score      numeric(7,4) not null default 0,
    transformation_candidate  boolean not null default false,
    transformation_decision   varchar(40) null,
    assigned_team             varchar(100) null,
    assigned_user_id          uuid null references public.user_account(id),
    opened_at                 timestamptz not null default now(),
    first_response_at         timestamptz null,
    resolved_at               timestamptz null,
    closed_at                 timestamptz null,
    resolution_code           varchar(80) null,
    resolution_summary        text null,
    root_cause_summary        text null,
    metadata                  jsonb not null default '{}'::jsonb,
    created_at                timestamptz not null default now(),
    created_by                uuid null,
    updated_at                timestamptz not null default now(),
    updated_by                uuid null,
    version_no                bigint not null default 1,
    constraint uq_incident_number unique (tenant_id, incident_number),
    constraint chk_incident_title check (length(title) >= 5),
    constraint chk_incident_financial check (financial_impact_estimate >= 0),
    constraint chk_incident_tx_count check (affected_transaction_count >= 0),
    constraint chk_incident_partner_count check (affected_partner_count >= 0),
    constraint chk_incident_score check (transformation_score >= 0 and transformation_score <= 100),
    constraint chk_incident_dates check (
        (resolved_at is null or resolved_at >= opened_at)
        and (closed_at is null or closed_at >= opened_at)
    )
);
create index if not exists idx_incident_tenant_status   on public.incident (tenant_id, status);
create index if not exists idx_incident_tenant_priority on public.incident (tenant_id, priority);
create index if not exists idx_incident_ci              on public.incident (tenant_id, affected_ci_id);
create index if not exists idx_incident_service         on public.incident (tenant_id, affected_service_id);
create index if not exists idx_incident_transformation  on public.incident (tenant_id, transformation_candidate, transformation_score desc);
create index if not exists idx_incident_opened_at       on public.incident (tenant_id, opened_at desc);
create index if not exists idx_incident_metadata_gin    on public.incident using gin (metadata);

-- ---- Numeracion automatica INC-YYYY-NNNNNN ----
create or replace function public.set_incident_number()
returns trigger language plpgsql as $$
begin
    if new.incident_number is null or new.incident_number = '' then
        new.incident_number := public.next_document_number(new.tenant_id, 'incident', 'INC');
    end if;
    return new;
end $$;
drop trigger if exists trg_incident_number on public.incident;
create trigger trg_incident_number before insert on public.incident
  for each row execute function public.set_incident_number();

drop trigger if exists trg_incident_updated on public.incident;
create trigger trg_incident_updated before update on public.incident
  for each row execute function public.set_updated_at();

-- --------------------------------------------------- incident_comment ----
create table if not exists public.incident_comment (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenant(id),
    incident_id         uuid not null references public.incident(id) on delete cascade,
    author_user_id      uuid null references public.user_account(id),
    visibility          varchar(40) not null default 'internal',
    body                text not null,
    is_system_generated boolean not null default false,
    created_at          timestamptz not null default now(),
    constraint chk_comment_visibility check (visibility in ('internal','partner','public','auditor')),
    constraint chk_comment_body check (length(body) >= 1)
);
create index if not exists idx_comment_incident on public.incident_comment (tenant_id, incident_id, created_at);

-- ---- audit triggers ----
drop trigger if exists trg_audit_incident on public.incident;
create trigger trg_audit_incident after insert or update or delete on public.incident
  for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_incident_comment on public.incident_comment;
create trigger trg_audit_incident_comment after insert or update or delete on public.incident_comment
  for each row execute function public.audit_row_change();

-- ---- RLS ----
alter table public.incident enable row level security;
drop policy if exists incident_isolation on public.incident;
create policy incident_isolation on public.incident for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.incident_comment enable row level security;
drop policy if exists incident_comment_isolation on public.incident_comment;
create policy incident_comment_isolation on public.incident_comment for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- ---- Mejora: el actor de auditoria toma auth.uid() cuando no hay GUC ----
create or replace function public.audit_row_change() returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_tenant uuid; v_entity uuid; v_payload jsonb; v_actor_type actor_type; v_actor_id uuid;
begin
    if tg_op = 'DELETE' then
        v_tenant := old.tenant_id; v_entity := old.id; v_payload := jsonb_build_object('before', to_jsonb(old));
    elsif tg_op = 'UPDATE' then
        v_tenant := new.tenant_id; v_entity := new.id; v_payload := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
    else
        v_tenant := new.tenant_id; v_entity := new.id; v_payload := jsonb_build_object('after', to_jsonb(new));
    end if;
    v_actor_id := coalesce(nullif(current_setting('app.current_actor_id', true), '')::uuid, auth.uid());
    v_actor_type := coalesce(
        nullif(current_setting('app.current_actor_type', true), '')::actor_type,
        case when auth.uid() is not null then 'user'::actor_type else 'system'::actor_type end);
    perform public.append_audit_event(v_tenant, v_actor_type, v_actor_id,
        tg_table_name::text || '.' || lower(tg_op), tg_table_name::text, v_entity, v_payload);
    if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
revoke execute on function public.audit_row_change() from public, anon, authenticated;
