-- 0110 — A3: un caso puede tener 1..N responsables (principal + colaboradores). Tabla aditiva;
-- incident.assigned_member_id se conserva como ESPEJO del principal (fuente para SLA/escalaciones
-- y retrocompatible con lista/detalle/panel rapido). Cambios de asignacion auditados por el trigger
-- generico (incident_assignee.insert/update/delete con antes/despues -> ledger). RLS por tenant,
-- mismo patron que incident_comment (current_tenant_id).

create table if not exists public.incident_assignee (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenant(id),
    incident_id  uuid not null references public.incident(id) on delete cascade,
    member_id    uuid not null references public.team_member(id) on delete cascade,
    is_primary   boolean not null default false,
    created_at   timestamptz not null default now(),
    created_by   uuid null,
    constraint uq_incident_assignee unique (incident_id, member_id)
);
create index if not exists idx_incident_assignee_incident on public.incident_assignee (tenant_id, incident_id);
-- A lo sumo UN principal por caso.
create unique index if not exists uq_incident_assignee_primary on public.incident_assignee (incident_id) where is_primary;

-- Auditoria (ledger) por el trigger generico, igual que las demas tablas de negocio.
drop trigger if exists trg_audit_incident_assignee on public.incident_assignee;
create trigger trg_audit_incident_assignee after insert or update or delete on public.incident_assignee
  for each row execute function public.audit_row_change();

-- RLS: aislamiento por tenant.
alter table public.incident_assignee enable row level security;
drop policy if exists incident_assignee_isolation on public.incident_assignee;
create policy incident_assignee_isolation on public.incident_assignee for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- Backfill: los casos con responsable actual quedan con ese recurso como PRINCIPAL.
insert into public.incident_assignee (tenant_id, incident_id, member_id, is_primary, created_by)
select i.tenant_id, i.id, i.assigned_member_id, true, i.updated_by
from public.incident i
where i.assigned_member_id is not null
on conflict (incident_id, member_id) do nothing;
