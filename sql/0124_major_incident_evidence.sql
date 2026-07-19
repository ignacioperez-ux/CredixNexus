-- 0124_major_incident_evidence.sql
-- Evidencia del incidente mayor. Espeja case_attachment: archivos en el bucket privado
-- "case-attachments" (URLs firmadas al listar), aislamiento por tenant (RLS) y auditoria
-- audit-grade via audit_row_change() (§11). La subida/borrado se gobierna en la app: SOLO
-- con el incidente mayor ACTIVO (estado no cerrado); cerrado = solo lectura, salvo reabrir.
-- Idempotente.

create table if not exists major_incident_evidence (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenant(id),
  mi_id        uuid not null references major_incident(id) on delete cascade,
  storage_path text not null unique,
  file_name    varchar not null,
  mime_type    varchar,
  size_bytes   bigint not null check (size_bytes >= 0),
  uploaded_by  uuid references user_account(id),
  created_at   timestamptz not null default now()
);

create index if not exists ix_mi_evidence_mi on major_incident_evidence(mi_id);
create index if not exists ix_mi_evidence_tenant on major_incident_evidence(tenant_id);

alter table major_incident_evidence enable row level security;

drop policy if exists major_incident_evidence_isolation on major_incident_evidence;
create policy major_incident_evidence_isolation on major_incident_evidence
  for all to authenticated
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

drop trigger if exists trg_audit_mi_evidence on major_incident_evidence;
create trigger trg_audit_mi_evidence
  after insert or update or delete on major_incident_evidence
  for each row execute function audit_row_change();
