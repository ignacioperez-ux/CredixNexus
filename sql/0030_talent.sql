-- ============================================================================
-- Credix Nexus — 0030 — Talento (habilidades, experiencia, desempeno)
-- Base para el recomendador de perfil idoneo. Datos sensibles (desempeno/
-- comportamiento) con RLS restringido por permiso (talent.read/manage).
-- ============================================================================

-- Helper de permisos (para RLS por rol). Segregacion de funciones (COBIT).
create or replace function public.has_permission(p_code text)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1
    from public.user_account ua
    join public.user_role ur on ur.user_id = ua.id and (ur.valid_to is null or ur.valid_to > now())
    join public.role_permission rp on rp.role_id = ur.role_id
    join public.permission p on p.id = rp.permission_id
    where ua.auth_user_id = auth.uid() and p.code = p_code
  );
$$;
revoke execute on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated, service_role;

-- team_member: interno/externo + seniority
alter table public.team_member add column if not exists is_external boolean not null default false;
alter table public.team_member add column if not exists seniority varchar(30) null;

-- ---- skill (catalogo de habilidades) ----
create table if not exists public.skill (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenant(id),
    code       varchar(80) not null,
    name       varchar(150) not null,
    category   varchar(80) not null default 'general',
    status     record_status not null default 'active',
    created_at timestamptz not null default now(),
    created_by uuid null,
    updated_at timestamptz not null default now(),
    updated_by uuid null,
    version_no bigint not null default 1,
    constraint uq_skill_code unique (tenant_id, code)
);

-- ---- member_skill (matriz de habilidades por persona) ----
create table if not exists public.member_skill (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenant(id),
    member_id  uuid not null references public.team_member(id) on delete cascade,
    skill_id   uuid not null references public.skill(id) on delete cascade,
    level      integer not null default 3,
    created_at timestamptz not null default now(),
    constraint uq_member_skill unique (member_id, skill_id),
    constraint chk_member_skill_level check (level between 1 and 5)
);
create index if not exists idx_member_skill on public.member_skill (tenant_id, member_id);

-- ---- member_expertise (experiencia por app/producto/proceso) ----
create table if not exists public.member_expertise (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenant(id),
    member_id   uuid not null references public.team_member(id) on delete cascade,
    entity_type varchar(80) not null,   -- configuration_item | product | process
    entity_id   uuid not null,
    level       integer not null default 3,
    created_at  timestamptz not null default now(),
    constraint uq_member_expertise unique (member_id, entity_type, entity_id),
    constraint chk_member_expertise_level check (level between 1 and 5)
);
create index if not exists idx_member_expertise on public.member_expertise (tenant_id, entity_type, entity_id);

-- ---- member_evaluation (desempeno/comportamiento) — SENSIBLE ----
create table if not exists public.member_evaluation (
    id                uuid primary key default gen_random_uuid(),
    tenant_id         uuid not null references public.tenant(id),
    member_id         uuid not null references public.team_member(id) on delete cascade,
    period            varchar(20) not null,
    performance_score numeric(5,2) null,
    behavior_note     text null,
    strengths         text null,
    development_areas  text null,
    evaluator_user_id uuid null references public.user_account(id),
    created_at        timestamptz not null default now(),
    created_by        uuid null,
    constraint uq_member_evaluation unique (member_id, period),
    constraint chk_eval_score check (performance_score is null or (performance_score >= 0 and performance_score <= 100))
);
create index if not exists idx_member_eval on public.member_evaluation (tenant_id, member_id);

-- ---- updated_at + audit ----
drop trigger if exists trg_skill_updated on public.skill;
create trigger trg_skill_updated before update on public.skill for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_skill on public.skill;
create trigger trg_audit_skill after insert or update or delete on public.skill for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_member_eval on public.member_evaluation;
create trigger trg_audit_member_eval after insert or update or delete on public.member_evaluation for each row execute function public.audit_row_change();

-- ---- RLS ----
alter table public.skill enable row level security;
drop policy if exists skill_isolation on public.skill;
create policy skill_isolation on public.skill for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.member_skill enable row level security;
drop policy if exists member_skill_isolation on public.member_skill;
create policy member_skill_isolation on public.member_skill for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.member_expertise enable row level security;
drop policy if exists member_expertise_isolation on public.member_expertise;
create policy member_expertise_isolation on public.member_expertise for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- Evaluaciones: solo con permiso talent.read (lectura) / talent.manage (escritura)
alter table public.member_evaluation enable row level security;
drop policy if exists member_eval_read on public.member_evaluation;
create policy member_eval_read on public.member_evaluation for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.has_permission('talent.read'));
drop policy if exists member_eval_write on public.member_evaluation;
create policy member_eval_write on public.member_evaluation for all to authenticated
  using (tenant_id = public.current_tenant_id() and public.has_permission('talent.manage'))
  with check (tenant_id = public.current_tenant_id() and public.has_permission('talent.manage'));

-- ---- Rol RRHH + permisos ----
insert into public.role (tenant_id, code, name, description, is_system)
values (null, 'people_lead', 'Lider de Personas / RRHH', 'Gestiona talento, desempeno y capacidades', true)
on conflict do nothing;

insert into public.permission (code, resource, action, description) values
  ('talent.read','talent','read','Ver perfil de talento y desempeno'),
  ('talent.manage','talent','manage','Gestionar talento y evaluaciones')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id from (values
  ('people_lead','talent.read'),('people_lead','talent.manage'),
  ('system_admin','talent.read'),('system_admin','talent.manage')
) as m(rc,pc)
join public.role r on r.code=m.rc and r.tenant_id is null
join public.permission p on p.code=m.pc on conflict do nothing;
