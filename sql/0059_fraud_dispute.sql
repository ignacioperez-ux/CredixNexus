-- 0059_fraud_dispute.sql
-- Fraude y Disputas como FLUJOS ESPECIALIZADOS anclados al incidente (1:1). El incidente
-- sigue siendo el ancla de comunicacion/tracking (la mesa nunca pierde el control); estas
-- tablas agregan el ciclo de vida y los campos propios de fraude/disputa. Multi-tenant + RLS
-- + auditado. Numeracion propia FR-/DP-. Cero topologia inventada: el seed usa incidentes
-- de fraude/disputa REALES ya existentes como ancla.

-- ============================ FRAUD ============================
create table if not exists public.fraud_case (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant(id) on delete cascade,
  incident_id        uuid not null references public.incident(id) on delete cascade,
  fraud_number       varchar(40) not null,
  fraud_type         varchar(24) not null default 'other' check (fraud_type in ('account_takeover','card_not_present','identity_theft','phishing','friendly_fraud','merchant_fraud','other')),
  status             varchar(16) not null default 'reported' check (status in ('reported','investigating','confirmed','false_positive','recovered','closed')),
  detection_source   varchar(20) not null default 'customer_report' check (detection_source in ('customer_report','monitoring_alert','manual_review','rule_engine')),
  risk_score         integer check (risk_score is null or (risk_score between 0 and 100)),
  amount_exposed     numeric(18,2) check (amount_exposed is null or amount_exposed >= 0),
  amount_recovered   numeric(18,2) not null default 0 check (amount_recovered >= 0),
  currency           varchar(3) not null default 'CRC',
  assigned_to_user_id uuid references public.user_account(id) on delete set null,
  resolution_notes   text,
  reported_at        timestamptz not null default now(),
  confirmed_at       timestamptz,
  recovered_at       timestamptz,
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  constraint uq_fraud_incident unique (incident_id),
  constraint uq_fraud_number unique (tenant_id, fraud_number)
);
create index if not exists idx_fraud_tenant on public.fraud_case (tenant_id, status);

-- ============================ DISPUTE ============================
create table if not exists public.dispute_case (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant(id) on delete cascade,
  incident_id        uuid not null references public.incident(id) on delete cascade,
  dispute_number     varchar(40) not null,
  dispute_type       varchar(24) not null default 'other' check (dispute_type in ('unrecognized_charge','duplicate_charge','payment_not_applied','incorrect_amount','service_not_received','refund_pending','other')),
  status             varchar(18) not null default 'opened' check (status in ('opened','investigating','awaiting_customer','submitted','won','lost','cancelled','closed')),
  reason_code        varchar(40),
  disputed_amount    numeric(18,2) check (disputed_amount is null or disputed_amount >= 0),
  amount_recovered   numeric(18,2) not null default 0 check (amount_recovered >= 0),
  currency           varchar(3) not null default 'CRC',
  transaction_reference varchar(120),
  processor_vendor_id uuid references public.vendor(id) on delete set null,
  assigned_to_user_id uuid references public.user_account(id) on delete set null,
  outcome            text,
  resolution_notes   text,
  opened_at          timestamptz not null default now(),
  due_date           date,
  resolved_at        timestamptz,
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  constraint uq_dispute_incident unique (incident_id),
  constraint uq_dispute_number unique (tenant_id, dispute_number),
  constraint chk_dispute_due check (due_date is null or due_date >= opened_at::date)
);
create index if not exists idx_dispute_tenant on public.dispute_case (tenant_id, status);
create index if not exists idx_dispute_due on public.dispute_case (tenant_id, due_date);

-- ---- numeracion ----
create or replace function public.set_fraud_number() returns trigger language plpgsql as $$
begin
  if new.fraud_number is null or new.fraud_number = '' then
    new.fraud_number := public.next_document_number(new.tenant_id, 'fraud', 'FR');
  end if;
  return new;
end $$;
drop trigger if exists trg_fraud_number on public.fraud_case;
create trigger trg_fraud_number before insert on public.fraud_case for each row execute function public.set_fraud_number();

create or replace function public.set_dispute_number() returns trigger language plpgsql as $$
begin
  if new.dispute_number is null or new.dispute_number = '' then
    new.dispute_number := public.next_document_number(new.tenant_id, 'dispute', 'DP');
  end if;
  return new;
end $$;
drop trigger if exists trg_dispute_number on public.dispute_case;
create trigger trg_dispute_number before insert on public.dispute_case for each row execute function public.set_dispute_number();

-- ---- updated_at + audit ----
drop trigger if exists trg_fraud_updated on public.fraud_case;
create trigger trg_fraud_updated before update on public.fraud_case for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_fraud on public.fraud_case;
create trigger trg_audit_fraud after insert or update or delete on public.fraud_case for each row execute function public.audit_row_change();
drop trigger if exists trg_dispute_updated on public.dispute_case;
create trigger trg_dispute_updated before update on public.dispute_case for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_dispute on public.dispute_case;
create trigger trg_audit_dispute after insert or update or delete on public.dispute_case for each row execute function public.audit_row_change();

-- ---- RLS ----
alter table public.fraud_case enable row level security;
drop policy if exists fraud_isolation on public.fraud_case;
create policy fraud_isolation on public.fraud_case for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
alter table public.dispute_case enable row level security;
drop policy if exists dispute_isolation on public.dispute_case;
create policy dispute_isolation on public.dispute_case for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- ---- permisos ----
insert into public.permission (code, resource, action, description) values
  ('fraud.read',     'fraud',   'read',   'Ver casos de fraude'),
  ('fraud.manage',   'fraud',   'manage', 'Gestionar casos de fraude'),
  ('dispute.read',   'dispute', 'read',   'Ver disputas'),
  ('dispute.manage', 'dispute', 'manage', 'Gestionar disputas')
on conflict (code) do nothing;

insert into public.role_permission (role_id, permission_id)
select r.id, p.id from public.permission p join public.role r on (
     (p.code='fraud.read'     and r.code in ('support_agent','support_lead','grc_officer','auditor','ai_agent','system_admin','tenant_admin'))
  or (p.code='fraud.manage'   and r.code in ('support_lead','grc_officer','system_admin','tenant_admin'))
  or (p.code='dispute.read'   and r.code in ('support_agent','support_lead','grc_officer','auditor','ai_agent','system_admin','tenant_admin'))
  or (p.code='dispute.manage' and r.code in ('support_agent','support_lead','grc_officer','system_admin','tenant_admin'))
)
where p.code in ('fraud.read','fraud.manage','dispute.read','dispute.manage')
on conflict do nothing;

-- ---- seed evidencia-basada: anclar a incidentes de fraude/disputa REALES ya existentes ----
insert into public.fraud_case (tenant_id, incident_id, fraud_type, status, detection_source, risk_score)
select i.tenant_id, i.id, 'other', 'investigating', 'customer_report', 72
from public.incident i join public.service s on s.id = i.affected_service_id
where s.code = 'SVC_FRAUD'
  and not exists (select 1 from public.fraud_case f where f.incident_id = i.id)
on conflict do nothing;

insert into public.dispute_case (tenant_id, incident_id, dispute_type, status, disputed_amount, currency, transaction_reference)
select i.tenant_id, i.id,
       case s.code when 'SVC_DUPLICATE_CHARGE' then 'duplicate_charge'
                   when 'SVC_UNRECOGNIZED_CHARGE' then 'unrecognized_charge'
                   when 'SVC_PAYMENT_NOT_APPLIED' then 'payment_not_applied' else 'other' end,
       'investigating', i.amount, i.currency, i.transaction_reference
from public.incident i join public.service s on s.id = i.affected_service_id
where s.code in ('SVC_DUPLICATE_CHARGE','SVC_UNRECOGNIZED_CHARGE','SVC_PAYMENT_NOT_APPLIED')
  and not exists (select 1 from public.dispute_case d where d.incident_id = i.id)
on conflict do nothing;
