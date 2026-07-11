-- 0066_case_evidence.sql
-- Experiencia de caso: adjuntos (evidencia) + checklist de tareas, anclados al incidente.
-- Adjuntos reales en Supabase Storage (bucket privado, aislado por tenant via la carpeta raiz
-- del path = tenant_id). Metadata + tareas en tablas con RLS + auditoria. Cero mock (§11).

-- ---- Bucket privado de adjuntos ----
insert into storage.buckets (id, name, public, file_size_limit)
values ('case-attachments', 'case-attachments', false, 10485760)  -- 10 MB
on conflict (id) do nothing;

-- RLS en storage.objects: el usuario solo ve/sube/borra objetos cuya primera carpeta es su tenant.
drop policy if exists case_attach_read on storage.objects;
create policy case_attach_read on storage.objects for select to authenticated
  using (bucket_id = 'case-attachments' and (storage.foldername(name))[1] = public.current_tenant_id()::text);
drop policy if exists case_attach_insert on storage.objects;
create policy case_attach_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'case-attachments' and (storage.foldername(name))[1] = public.current_tenant_id()::text);
drop policy if exists case_attach_delete on storage.objects;
create policy case_attach_delete on storage.objects for delete to authenticated
  using (bucket_id = 'case-attachments' and (storage.foldername(name))[1] = public.current_tenant_id()::text);

-- ---- Metadata de adjuntos ----
create table if not exists public.case_attachment (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id) on delete cascade,
  incident_id   uuid not null references public.incident(id) on delete cascade,
  storage_path  text not null unique,
  file_name     varchar(260) not null,
  mime_type     varchar(120),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by   uuid references public.user_account(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_case_attachment_incident on public.case_attachment (tenant_id, incident_id);

-- ---- Checklist de tareas ----
create table if not exists public.case_task (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant(id) on delete cascade,
  incident_id        uuid not null references public.incident(id) on delete cascade,
  title              varchar(300) not null,
  status             varchar(10) not null default 'open' check (status in ('open','done','cancelled')),
  position           integer not null default 0,
  assigned_to_user_id uuid references public.user_account(id) on delete set null,
  due_date           date,
  done_at            timestamptz,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);
create index if not exists idx_case_task_incident on public.case_task (tenant_id, incident_id, position);

-- ---- updated_at + auditoria ----
drop trigger if exists trg_case_task_updated on public.case_task;
create trigger trg_case_task_updated before update on public.case_task for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_case_attachment on public.case_attachment;
create trigger trg_audit_case_attachment after insert or update or delete on public.case_attachment for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_case_task on public.case_task;
create trigger trg_audit_case_task after insert or update or delete on public.case_task for each row execute function public.audit_row_change();

-- ---- RLS ----
alter table public.case_attachment enable row level security;
drop policy if exists case_attachment_isolation on public.case_attachment;
create policy case_attachment_isolation on public.case_attachment for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
alter table public.case_task enable row level security;
drop policy if exists case_task_isolation on public.case_task;
create policy case_task_isolation on public.case_task for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
