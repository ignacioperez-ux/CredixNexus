-- ============================================================================
-- Credix Nexus — 0001 — Extensiones, tipos ENUM y helpers base
-- Fase F0 (Cimientos). Idempotente donde el motor lo permite.
-- ============================================================================

-- ---- Extensiones ----
create extension if not exists pgcrypto;      -- gen_random_uuid, digest (sha256)
create extension if not exists citext;        -- email case-insensitive

-- ---- Tipos ENUM (creacion idempotente via DO block) ----
do $$ begin
  create type record_status as enum ('draft','active','inactive','archived','deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tenant_type as enum ('internal','originator','investor','buyer','partner','group');
exception when duplicate_object then null; end $$;

do $$ begin
  create type party_type as enum ('person','organization','system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type actor_type as enum ('user','service','agent','system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type incident_status as enum
    ('new','triaged','assigned','in_progress','waiting','resolved','closed','reopened','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type priority_level as enum ('p1_critical','p2_high','p3_medium','p4_low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type impact_level as enum ('critical','high','medium','low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type urgency_level as enum ('critical','high','medium','low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rule_type as enum
    ('routing','sla','risk','transformation','approval','security','scoring','tenant_override');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum
    ('proposed','approved','active','on_hold','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('pending','approved','rejected','cancelled');
exception when duplicate_object then null; end $$;

-- ---- Helper: mantener updated_at / version_no en cada UPDATE ----
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'version_no' then
    new.version_no := coalesce(old.version_no, 0) + 1;
  end if;
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE: refresca updated_at y auto-incrementa version_no si la tabla lo tiene.';
