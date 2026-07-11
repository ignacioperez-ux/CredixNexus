-- ============================================================================
-- Credix Nexus — 0025 — Proyectos de Evolucion (F3)
-- Recomendacion aprobada por el RC -> proyecto atendido por un SQUAD.
-- Backlog priorizado con WSJF (SAFe) = (valor + criticidad + riesgo) / tamano.
-- Enlace bidireccional incidente<->proyecto; la mesa mantiene el tracking.
-- ============================================================================

create table if not exists public.project (
    id                          uuid primary key default gen_random_uuid(),
    tenant_id                   uuid not null references public.tenant(id),
    project_code                varchar(50) not null,
    name                        varchar(250) not null,
    description                 text null,
    project_type                varchar(80) not null default 'evolution',
    source_type                 varchar(80) not null default 'incident',
    status                      project_status not null default 'proposed',
    sponsor_user_id             uuid null references public.user_account(id),
    owner_user_id               uuid null references public.user_account(id),  -- PO
    squad_id                    uuid null references public.squad(id),         -- squad que lo atiende
    business_unit_id            uuid null references public.business_unit(id),
    product_id                  uuid null references public.product(id),
    estimated_benefit_amount    numeric(18,2) not null default 0,
    estimated_cost_amount       numeric(18,2) not null default 0,
    business_case               jsonb not null default '{}'::jsonb,
    -- WSJF (SAFe): priorizacion del backlog de Evolucion
    business_value              integer not null default 0,
    time_criticality            integer not null default 0,
    risk_reduction              integer not null default 0,
    job_size                    integer not null default 1,
    wsjf                        numeric(10,4) generated always as
                                  (((business_value + time_criticality + risk_reduction)::numeric) / nullif(job_size, 0)) stored,
    planned_start               date null,
    planned_end                 date null,
    actual_start                date null,
    actual_end                  date null,
    created_from_incident_id       uuid null references public.incident(id),
    created_from_recommendation_id uuid null references public.project_recommendation(id),
    created_from_rule_evaluation_id uuid null references public.rule_evaluation(id),
    created_at                  timestamptz not null default now(),
    created_by                  uuid null,
    updated_at                  timestamptz not null default now(),
    updated_by                  uuid null,
    version_no                  bigint not null default 1,
    constraint uq_project_code unique (tenant_id, project_code),
    constraint chk_project_amounts check (estimated_benefit_amount >= 0 and estimated_cost_amount >= 0),
    constraint chk_project_wsjf check (business_value >= 0 and time_criticality >= 0 and risk_reduction >= 0 and job_size > 0),
    constraint chk_project_dates check (planned_end is null or planned_start is null or planned_end >= planned_start)
);
create index if not exists idx_project_status on public.project (tenant_id, status, wsjf desc);
create index if not exists idx_project_squad on public.project (tenant_id, squad_id);
create index if not exists idx_project_incident on public.project (tenant_id, created_from_incident_id);

create table if not exists public.project_incident_link (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenant(id),
    project_id  uuid not null references public.project(id) on delete cascade,
    incident_id uuid not null references public.incident(id),
    link_type   varchar(50) not null default 'source',
    linked_at   timestamptz not null default now(),
    linked_by   uuid null references public.user_account(id),
    constraint uq_project_incident unique (tenant_id, project_id, incident_id)
);
create index if not exists idx_pil_incident on public.project_incident_link (tenant_id, incident_id);

create table if not exists public.project_task (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenant(id),
    project_id    uuid not null references public.project(id) on delete cascade,
    title         varchar(250) not null,
    description   text null,
    owner_user_id uuid null references public.user_account(id),
    status        varchar(40) not null default 'todo',
    priority      priority_level not null default 'p3_medium',
    due_date      date null,
    completed_at  timestamptz null,
    metadata      jsonb not null default '{}'::jsonb,
    created_at    timestamptz not null default now(),
    constraint chk_task_status check (status in ('todo','doing','blocked','done')),
    constraint chk_task_title check (length(title) >= 3)
);
create index if not exists idx_task_project on public.project_task (tenant_id, project_id, status);

-- Numeracion PRJ-YYYY-NNNNNN
create or replace function public.set_project_number()
returns trigger language plpgsql as $$
begin
    if new.project_code is null or new.project_code = '' then
        new.project_code := public.next_document_number(new.tenant_id, 'project', 'PRJ');
    end if;
    return new;
end $$;
drop trigger if exists trg_project_number on public.project;
create trigger trg_project_number before insert on public.project
  for each row execute function public.set_project_number();

drop trigger if exists trg_project_updated on public.project;
create trigger trg_project_updated before update on public.project for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_project on public.project;
create trigger trg_audit_project after insert or update or delete on public.project for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_pil on public.project_incident_link;
create trigger trg_audit_pil after insert or update or delete on public.project_incident_link for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_task on public.project_task;
create trigger trg_audit_task after insert or update or delete on public.project_task for each row execute function public.audit_row_change();

-- RLS
alter table public.project enable row level security;
drop policy if exists project_isolation on public.project;
create policy project_isolation on public.project for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.project_incident_link enable row level security;
drop policy if exists pil_isolation on public.project_incident_link;
create policy pil_isolation on public.project_incident_link for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.project_task enable row level security;
drop policy if exists task_isolation on public.project_task;
create policy task_isolation on public.project_task for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
