-- ============================================================================
-- Credix Nexus — 0018 — Knowledge Management (ITIL)
-- La solucion de una incidencia se captura como articulo reutilizable, versionado
-- y aprobable. Enlazado a la incidencia origen (source_incident_id).
-- ============================================================================

create table if not exists public.knowledge_article (
    id                uuid primary key default gen_random_uuid(),
    tenant_id         uuid not null references public.tenant(id),
    article_number    varchar(40) not null,
    title             varchar(250) not null,
    category          varchar(80) not null default 'general',
    status            record_status not null default 'draft',
    owner_user_id     uuid null references public.user_account(id),
    source_incident_id uuid null references public.incident(id),
    created_at        timestamptz not null default now(),
    created_by        uuid null,
    updated_at        timestamptz not null default now(),
    updated_by        uuid null,
    version_no        bigint not null default 1,
    constraint uq_article_number unique (tenant_id, article_number),
    constraint chk_article_title check (length(title) >= 5)
);
create index if not exists idx_article_tenant on public.knowledge_article (tenant_id, status, category);
create index if not exists idx_article_source on public.knowledge_article (tenant_id, source_incident_id);

create table if not exists public.knowledge_article_version (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenant(id),
    article_id       uuid not null references public.knowledge_article(id) on delete cascade,
    version_number   integer not null,
    content_markdown text not null,
    summary          text null,
    tags             text[] not null default array[]::text[],
    approved_by      uuid null references public.user_account(id),
    approved_at      timestamptz null,
    created_at       timestamptz not null default now(),
    created_by       uuid null,
    constraint uq_article_version unique (article_id, version_number),
    constraint chk_article_content check (length(content_markdown) >= 1)
);
create index if not exists idx_article_version on public.knowledge_article_version (tenant_id, article_id, version_number desc);

-- Numeracion KB-YYYY-NNNNNN
create or replace function public.set_article_number()
returns trigger language plpgsql as $$
begin
    if new.article_number is null or new.article_number = '' then
        new.article_number := public.next_document_number(new.tenant_id, 'knowledge', 'KB');
    end if;
    return new;
end $$;
drop trigger if exists trg_article_number on public.knowledge_article;
create trigger trg_article_number before insert on public.knowledge_article
  for each row execute function public.set_article_number();

drop trigger if exists trg_article_updated on public.knowledge_article;
create trigger trg_article_updated before update on public.knowledge_article for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_article on public.knowledge_article;
create trigger trg_audit_article after insert or update or delete on public.knowledge_article for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_article_version on public.knowledge_article_version;
create trigger trg_audit_article_version after insert or update or delete on public.knowledge_article_version for each row execute function public.audit_row_change();

-- RLS
alter table public.knowledge_article enable row level security;
drop policy if exists article_isolation on public.knowledge_article;
create policy article_isolation on public.knowledge_article for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.knowledge_article_version enable row level security;
drop policy if exists article_version_isolation on public.knowledge_article_version;
create policy article_version_isolation on public.knowledge_article_version for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- Seed: articulo demo derivado de la incidencia resuelta (resolucion -> KB).
do $$
declare v_tenant uuid; v_inc uuid; v_article uuid;
begin
  select id into v_tenant from public.tenant where code='CORE';
  select id into v_inc from public.incident where tenant_id=v_tenant and status='resolved' limit 1;
  if v_tenant is not null and not exists (select 1 from public.knowledge_article where tenant_id=v_tenant) then
    insert into public.knowledge_article (tenant_id, title, category, status, source_incident_id)
    values (v_tenant, 'Procedimiento de restablecimiento de contrasena', 'access', 'active', v_inc)
    returning id into v_article;
    insert into public.knowledge_article_version (tenant_id, article_id, version_number, content_markdown, summary, tags)
    values (v_tenant, v_article, 1,
      E'# Restablecimiento de contrasena\n\n1. Verificar identidad del colaborador.\n2. Resetear en Active Directory.\n3. Forzar cambio en el primer ingreso.\n4. Registrar en el ticket.',
      'Pasos para resetear contrasena de usuario interno.',
      array['acceso','contrasena','active-directory']);
  end if;
end $$;
