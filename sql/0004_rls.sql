-- ============================================================================
-- Credix Nexus — 0004 — Row-Level Security (aislamiento multi-tenant)
-- Patron Supabase: ENABLE RLS (no FORCE). service_role y funciones security
-- definer (BYPASSRLS) operan; el rol `authenticated` queda aislado por tenant.
-- Regla CLAUDE.md 3.2 #3: toda tabla con tenant_id necesita RLS + policy por tenant.
-- ============================================================================

-- ---- tenant: su "tenant" es su propio id ----
alter table public.tenant enable row level security;
drop policy if exists tenant_isolation on public.tenant;
create policy tenant_isolation on public.tenant
  for all to authenticated
  using (id = public.current_tenant_id())
  with check (id = public.current_tenant_id());

-- ---- Tablas con tenant_id: aislamiento estandar ----
alter table public.party enable row level security;
drop policy if exists party_isolation on public.party;
create policy party_isolation on public.party
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.party_role enable row level security;
drop policy if exists party_role_isolation on public.party_role;
create policy party_role_isolation on public.party_role
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.user_account enable row level security;
drop policy if exists user_account_isolation on public.user_account;
create policy user_account_isolation on public.user_account
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- ---- Ledger: solo lectura del propio tenant. Escritura solo via append_audit_event
--      (security definer). Sin policies de insert/update/delete -> bloqueadas para authenticated.
alter table public.immutable_audit_event enable row level security;
drop policy if exists audit_read on public.immutable_audit_event;
create policy audit_read on public.immutable_audit_event
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- ---- role: roles del tenant + roles globales (tenant_id null) visibles ----
alter table public.role enable row level security;
drop policy if exists role_read on public.role;
create policy role_read on public.role
  for select to authenticated
  using (tenant_id is null or tenant_id = public.current_tenant_id());
drop policy if exists role_write on public.role;
create policy role_write on public.role
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- ---- permission: catalogo global de solo lectura ----
alter table public.permission enable row level security;
drop policy if exists permission_read on public.permission;
create policy permission_read on public.permission
  for select to authenticated using (true);

-- ---- role_permission: alcance via el role padre ----
alter table public.role_permission enable row level security;
drop policy if exists role_permission_scope on public.role_permission;
create policy role_permission_scope on public.role_permission
  for all to authenticated
  using (exists (select 1 from public.role r where r.id = role_id
                  and (r.tenant_id is null or r.tenant_id = public.current_tenant_id())))
  with check (exists (select 1 from public.role r where r.id = role_id
                  and r.tenant_id = public.current_tenant_id()));

-- ---- user_role: alcance via el user padre ----
alter table public.user_role enable row level security;
drop policy if exists user_role_scope on public.user_role;
create policy user_role_scope on public.user_role
  for all to authenticated
  using (exists (select 1 from public.user_account u where u.id = user_id
                  and u.tenant_id = public.current_tenant_id()))
  with check (exists (select 1 from public.user_account u where u.id = user_id
                  and u.tenant_id = public.current_tenant_id()));
