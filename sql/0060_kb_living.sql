-- 0060_kb_living.sql
-- KB VIVA: la base de conocimiento aprende del uso. Agrega tipos de articulo
-- (how_to/runbook/known_error/faq/policy), feedback util/no-util (opinion, auditada) y
-- telemetria de deflection/escalacion (vistas y casos evitados vs. creados). Contadores
-- denormalizados mantenidos por triggers. Multi-tenant + RLS.

-- ---- 1. Tipos + contadores en el articulo ----
alter table public.knowledge_article
  add column if not exists article_type varchar(20) not null default 'how_to'
    check (article_type in ('how_to','runbook','known_error','faq','policy')),
  add column if not exists source_problem_id uuid references public.problem(id) on delete set null,
  add column if not exists helpful_count integer not null default 0,
  add column if not exists not_helpful_count integer not null default 0,
  add column if not exists view_count integer not null default 0,
  add column if not exists deflection_count integer not null default 0,
  add column if not exists escalation_count integer not null default 0;

create index if not exists idx_article_type on public.knowledge_article (tenant_id, article_type, status);

-- ---- 2. Feedback (opinion de record, auditada) ----
create table if not exists public.knowledge_feedback (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant(id) on delete cascade,
  article_id      uuid not null references public.knowledge_article(id) on delete cascade,
  user_account_id uuid references public.user_account(id) on delete set null,
  helpful         boolean not null,
  comment         text,
  source          varchar(16) not null default 'kb' check (source in ('kb','portal','incident')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_kb_feedback_user unique (article_id, user_account_id)
);
create index if not exists idx_kb_feedback_article on public.knowledge_feedback (tenant_id, article_id);

-- ---- 3. Telemetria de uso (view/deflection/escalation) — no auditada (alto volumen) ----
create table if not exists public.knowledge_event (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant(id) on delete cascade,
  article_id      uuid not null references public.knowledge_article(id) on delete cascade,
  event_type      varchar(12) not null check (event_type in ('view','deflection','escalation')),
  user_account_id uuid references public.user_account(id) on delete set null,
  source          varchar(16) not null default 'portal' check (source in ('kb','portal','incident')),
  query           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_kb_event_article on public.knowledge_event (tenant_id, article_id, event_type);

-- ---- 4. Triggers de contadores (SECURITY DEFINER, tenant-scoped por WHERE) ----
create or replace function public.kb_refresh_feedback_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_article uuid;
begin
  v_article := coalesce(new.article_id, old.article_id);
  update public.knowledge_article a set
    helpful_count     = (select count(*) from public.knowledge_feedback f where f.article_id = v_article and f.helpful),
    not_helpful_count = (select count(*) from public.knowledge_feedback f where f.article_id = v_article and not f.helpful)
  where a.id = v_article;
  return null;
end $$;
drop trigger if exists trg_kb_feedback_counts on public.knowledge_feedback;
create trigger trg_kb_feedback_counts after insert or update or delete on public.knowledge_feedback
  for each row execute function public.kb_refresh_feedback_counts();

create or replace function public.kb_bump_event_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.knowledge_article a set
    view_count       = a.view_count       + (case when new.event_type = 'view'       then 1 else 0 end),
    deflection_count = a.deflection_count + (case when new.event_type = 'deflection' then 1 else 0 end),
    escalation_count = a.escalation_count + (case when new.event_type = 'escalation' then 1 else 0 end)
  where a.id = new.article_id;
  return null;
end $$;
drop trigger if exists trg_kb_event_counts on public.knowledge_event;
create trigger trg_kb_event_counts after insert on public.knowledge_event
  for each row execute function public.kb_bump_event_counts();

-- updated_at + audit en feedback (opinion de record)
drop trigger if exists trg_kb_feedback_updated on public.knowledge_feedback;
create trigger trg_kb_feedback_updated before update on public.knowledge_feedback for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_kb_feedback on public.knowledge_feedback;
create trigger trg_audit_kb_feedback after insert or update or delete on public.knowledge_feedback for each row execute function public.audit_row_change();

-- ---- 5. RLS ----
alter table public.knowledge_feedback enable row level security;
drop policy if exists kb_feedback_isolation on public.knowledge_feedback;
create policy kb_feedback_isolation on public.knowledge_feedback for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
alter table public.knowledge_event enable row level security;
drop policy if exists kb_event_isolation on public.knowledge_event;
create policy kb_event_isolation on public.knowledge_event for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- ---- 6. Permisos ----
insert into public.permission (code, resource, action, description) values
  ('knowledge.feedback', 'knowledge', 'feedback', 'Calificar articulos de conocimiento')
on conflict (code) do nothing;
insert into public.role_permission (role_id, permission_id)
select r.id, p.id from public.permission p join public.role r on
  (p.code='knowledge.feedback' and r.code in ('support_agent','support_lead','change_manager','grc_officer','product_owner','business_owner','people_lead','system_admin','tenant_admin'))
where p.code='knowledge.feedback'
on conflict do nothing;

-- ---- 7. Clasificacion de los articulos existentes (por su contenido, no inventado) ----
update public.knowledge_article set article_type = 'runbook'
where article_type = 'how_to' and title in
  ('Procedimiento de restablecimiento de contrasena', 'Acceso a VPN y sistemas internos', 'Diferencias en conciliacion');
