-- 0052_case_triage.sql
-- F3: Admision/triage del caso. Todo caso se registra y se valida: ADMITIDO o
-- DESCARTADO (siempre queda; si se descarta pasa a resuelto con el motivo). Si se
-- admite se clasifica: incidencia | mejora | proyecto. La incidencia queda en
-- Operaciones; mejora/proyecto se enruta a Evolucion. Chequeo previo de base de
-- conocimiento. El incident es el ancla del caso. Audit-grade + integridad.

alter table public.incident
  add column if not exists intake_status varchar(12) not null default 'pending'
    check (intake_status in ('pending','accepted','discarded')),
  add column if not exists classified_as varchar(12)
    check (classified_as is null or classified_as in ('incident','improvement','project')),
  add column if not exists discard_reason text,
  add column if not exists triaged_by uuid,
  add column if not exists triaged_at timestamptz,
  add column if not exists kb_matched_article_id uuid references public.knowledge_article(id) on delete set null;

-- Reglas de integridad (espejo de la logica de negocio):
alter table public.incident
  drop constraint if exists incident_discard_needs_reason,
  add constraint incident_discard_needs_reason check (intake_status <> 'discarded' or discard_reason is not null);
alter table public.incident
  drop constraint if exists incident_accept_needs_class,
  add constraint incident_accept_needs_class check (intake_status <> 'accepted' or classified_as is not null);

create index if not exists idx_incident_intake on public.incident (tenant_id, intake_status);

insert into public.permission (code, resource, action, description) values
  ('triage.manage', 'triage', 'manage', 'Admitir, descartar y clasificar casos (triage)')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id
from public.permission p
join public.role r on (p.code = 'triage.manage' and r.code in ('support_agent','support_lead','change_manager','system_admin','tenant_admin'))
where p.code = 'triage.manage'
on conflict do nothing;

-- Backfill: los casos existentes ya estaban en gestion -> admitidos.
-- Los que estan en evolucion se clasifican como proyecto; el resto, incidencia.
update public.incident
   set intake_status = 'accepted',
       classified_as = case when status = 'in_evolution' then 'project' else 'incident' end,
       triaged_at = coalesce(triaged_at, opened_at)
 where intake_status = 'pending' and status not in ('cancelled');
