-- ============================================================================
-- Credix Nexus — 0003 — Ledger inmutable (audit-grade, hash-chaining)
-- Regla absoluta: ninguna mutacion relevante existe sin su immutable_audit_event.
-- Nota: sin particionar en F0 (ver CLAUDE.md / decision documentada). Los appends
-- pasan siempre por append_audit_event(), asi el particionamiento futuro no toca la app.
-- ============================================================================

create table if not exists public.immutable_audit_event (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenant(id),
    block_height   bigint not null,
    previous_hash  varchar(128) null,
    current_hash   varchar(128) not null,
    "timestamp"    timestamptz not null default now(),
    actor_type     actor_type not null,
    actor_id       uuid null,
    action         varchar(120) not null,
    entity_type    varchar(120) not null,
    entity_id      uuid not null,
    payload        jsonb not null,
    rule_id        uuid null,
    signature      text null,
    source_ip      inet null,
    user_agent     text null,
    correlation_id uuid null,
    causation_id   uuid null,
    constraint uq_audit_block check (block_height >= 0),
    constraint chk_audit_hash_length check (length(current_hash) >= 64)
);
-- Un solo bloque por (tenant, altura) y hash unico por tenant (cadena por tenant).
create unique index if not exists uq_audit_tenant_block on public.immutable_audit_event (tenant_id, block_height);
create unique index if not exists uq_audit_tenant_hash  on public.immutable_audit_event (tenant_id, current_hash);

create index if not exists idx_audit_entity      on public.immutable_audit_event (tenant_id, entity_type, entity_id, "timestamp" desc);
create index if not exists idx_audit_actor       on public.immutable_audit_event (tenant_id, actor_type, actor_id, "timestamp" desc);
create index if not exists idx_audit_correlation on public.immutable_audit_event (tenant_id, correlation_id, "timestamp" desc);
create index if not exists idx_audit_payload_gin on public.immutable_audit_event using gin (payload);

-- --------------------------------------------------- compute_audit_hash ----
create or replace function public.compute_audit_hash(
    p_tenant_id     uuid,
    p_previous_hash varchar,
    p_timestamp     timestamptz,
    p_actor_type    actor_type,
    p_actor_id      uuid,
    p_action        varchar,
    p_entity_type   varchar,
    p_entity_id     uuid,
    p_payload       jsonb,
    p_block_height  bigint
) returns varchar
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
    canonical_text text;
begin
    canonical_text :=
        coalesce(p_tenant_id::text, '') || '|' ||
        coalesce(p_previous_hash, '') || '|' ||
        to_char(p_timestamp at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' ||
        coalesce(p_actor_type::text, '') || '|' ||
        coalesce(p_actor_id::text, '') || '|' ||
        coalesce(p_action, '') || '|' ||
        coalesce(p_entity_type, '') || '|' ||
        coalesce(p_entity_id::text, '') || '|' ||
        coalesce(p_payload::text, '{}') || '|' ||
        coalesce(p_block_height::text, '');
    return encode(extensions.digest(canonical_text, 'sha256'), 'hex');
end;
$$;

-- ---------------------------------------------------- append_audit_event ----
-- Append atomico con hash-chaining por tenant. Serializa por tenant con advisory
-- lock transaccional para evitar carreras en previous_hash / block_height.
create or replace function public.append_audit_event(
    p_tenant_id      uuid,
    p_actor_type     actor_type,
    p_actor_id       uuid,
    p_action         varchar,
    p_entity_type    varchar,
    p_entity_id      uuid,
    p_payload        jsonb,
    p_rule_id        uuid    default null,
    p_correlation_id uuid    default null,
    p_causation_id   uuid    default null,
    p_source_ip      inet    default null,
    p_user_agent     text    default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_prev_hash   varchar(128);
    v_prev_height bigint;
    v_height      bigint;
    v_ts          timestamptz := clock_timestamp();
    v_hash        varchar(128);
    v_id          uuid;
begin
    if p_tenant_id is null then
        raise exception 'append_audit_event: tenant_id es obligatorio';
    end if;

    -- Serializa la cadena de este tenant dentro de la transaccion.
    perform pg_advisory_xact_lock(hashtext('credix_ledger'), hashtext(p_tenant_id::text));

    select current_hash, block_height
      into v_prev_hash, v_prev_height
      from public.immutable_audit_event
     where tenant_id = p_tenant_id
     order by block_height desc
     limit 1;

    v_height := coalesce(v_prev_height, -1) + 1;

    v_hash := public.compute_audit_hash(
        p_tenant_id, v_prev_hash, v_ts, p_actor_type, p_actor_id,
        p_action, p_entity_type, p_entity_id, p_payload, v_height
    );

    insert into public.immutable_audit_event (
        tenant_id, block_height, previous_hash, current_hash, "timestamp",
        actor_type, actor_id, action, entity_type, entity_id, payload,
        rule_id, correlation_id, causation_id, source_ip, user_agent
    ) values (
        p_tenant_id, v_height, v_prev_hash, v_hash, v_ts,
        p_actor_type, p_actor_id, p_action, p_entity_type, p_entity_id, p_payload,
        p_rule_id, p_correlation_id, p_causation_id, p_source_ip, p_user_agent
    ) returning id into v_id;

    return v_id;
end;
$$;
comment on function public.append_audit_event is
  'Unico camino de escritura del ledger. Hash-chaining por tenant, serializado con advisory lock.';

-- --------------------------------------- Inmutabilidad: bloquear UPDATE/DELETE ----
create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
as $$
begin
    raise exception 'immutable_audit_event es append-only. UPDATE/DELETE no permitido.';
end;
$$;

drop trigger if exists trg_prevent_audit_update on public.immutable_audit_event;
create trigger trg_prevent_audit_update
  before update on public.immutable_audit_event
  for each row execute function public.prevent_audit_mutation();

drop trigger if exists trg_prevent_audit_delete on public.immutable_audit_event;
create trigger trg_prevent_audit_delete
  before delete on public.immutable_audit_event
  for each row execute function public.prevent_audit_mutation();

-- ---------------------------------------------------- verify_audit_chain ----
-- Verifica recomputo de hash y enlace previous_hash contra el bloque anterior.
create or replace function public.verify_audit_chain(p_tenant_id uuid)
returns table (
    block_height    bigint,
    stored_hash     varchar,
    recomputed_hash varchar,
    hash_ok         boolean,
    link_ok         boolean
)
language plpgsql
stable
as $$
begin
    return query
    with chain as (
        select e.*,
               lag(e.current_hash) over (order by e.block_height) as expected_prev
          from public.immutable_audit_event e
         where e.tenant_id = p_tenant_id
    )
    select
        c.block_height,
        c.current_hash as stored_hash,
        public.compute_audit_hash(
            c.tenant_id, c.previous_hash, c."timestamp", c.actor_type, c.actor_id,
            c.action, c.entity_type, c.entity_id, c.payload, c.block_height
        ) as recomputed_hash,
        c.current_hash = public.compute_audit_hash(
            c.tenant_id, c.previous_hash, c."timestamp", c.actor_type, c.actor_id,
            c.action, c.entity_type, c.entity_id, c.payload, c.block_height
        ) as hash_ok,
        (c.block_height = 0 and c.previous_hash is null)
          or (c.previous_hash is not distinct from c.expected_prev) as link_ok
    from chain c
    order by c.block_height;
end;
$$;

-- ------------------------------------- Trigger generico de auditoria (maestros) ----
-- Registra en el ledger toda alta/cambio/baja de tablas maestras. Actor tomado de
-- GUCs de sesion (app.current_actor_id / app.current_actor_type); default 'system'.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tenant     uuid;
    v_entity     uuid;
    v_payload    jsonb;
    v_actor_type actor_type;
    v_actor_id   uuid;
begin
    if tg_op = 'DELETE' then
        v_tenant  := old.tenant_id;
        v_entity  := old.id;
        v_payload := jsonb_build_object('before', to_jsonb(old));
    elsif tg_op = 'UPDATE' then
        v_tenant  := new.tenant_id;
        v_entity  := new.id;
        v_payload := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
    else -- INSERT
        v_tenant  := new.tenant_id;
        v_entity  := new.id;
        v_payload := jsonb_build_object('after', to_jsonb(new));
    end if;

    v_actor_type := coalesce(nullif(current_setting('app.current_actor_type', true), '')::actor_type, 'system');
    v_actor_id   := nullif(current_setting('app.current_actor_id', true), '')::uuid;

    perform public.append_audit_event(
        v_tenant, v_actor_type, v_actor_id,
        tg_table_name::text || '.' || lower(tg_op),
        tg_table_name::text, v_entity, v_payload
    );

    if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
comment on function public.audit_row_change() is
  'Trigger AFTER INSERT/UPDATE/DELETE: registra la mutacion en el ledger inmutable.';

-- La tabla tenant no tiene columna tenant_id: su tenant es su propio id.
create or replace function public.audit_tenant_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tenant     uuid;
    v_payload    jsonb;
    v_actor_type actor_type;
    v_actor_id   uuid;
begin
    if tg_op = 'DELETE' then
        v_tenant  := old.id;
        v_payload := jsonb_build_object('before', to_jsonb(old));
    elsif tg_op = 'UPDATE' then
        v_tenant  := new.id;
        v_payload := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
    else
        v_tenant  := new.id;
        v_payload := jsonb_build_object('after', to_jsonb(new));
    end if;

    v_actor_type := coalesce(nullif(current_setting('app.current_actor_type', true), '')::actor_type, 'system');
    v_actor_id   := nullif(current_setting('app.current_actor_id', true), '')::uuid;

    perform public.append_audit_event(
        v_tenant, v_actor_type, v_actor_id,
        'tenant.' || lower(tg_op), 'tenant', v_tenant, v_payload
    );

    if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Adjuntar a maestros de identidad.
drop trigger if exists trg_audit_tenant on public.tenant;
create trigger trg_audit_tenant after insert or update or delete on public.tenant
  for each row execute function public.audit_tenant_change();

drop trigger if exists trg_audit_party on public.party;
create trigger trg_audit_party after insert or update or delete on public.party
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_party_role on public.party_role;
create trigger trg_audit_party_role after insert or update or delete on public.party_role
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_user on public.user_account;
create trigger trg_audit_user after insert or update or delete on public.user_account
  for each row execute function public.audit_row_change();
