-- 0075_talent_professionals.sql
-- Modulo de Talento: profesionales (internos/externos) con competencias, experiencia,
-- stream de atencion (operaciones/evolucion) y evaluaciones (efectividad + empatia).
--
-- Modelo reutilizado (cero invencion):
--  - stream = delivery_area (code operations|evolution); responsable = delivery_area.lead_name
--    (ya seteado: Operaciones -> Giselle Arias, Evolucion -> Daniel Blohm).
--  - competencias = skill + member_skill (nivel 1-5).
--  - experiencia = member_expertise (polimorfica: process, business_unit, product, channel,
--    configuration_item, service, technology...). Ya existe; solo se amplian los entity_type usados.
--  - evaluaciones = member_evaluation. Se agrega empatia + tipo (general/incident/project) + enlace.

-- 1) team_member: contacto, tipo de externo, stream de atencion y auditoria.
alter table public.team_member
  add column if not exists email varchar,
  add column if not exists external_type varchar,
  add column if not exists delivery_area_id uuid references public.delivery_area(id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid;

-- external_type solo valores validos y solo para externos.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'team_member_external_type_chk') then
    alter table public.team_member
      add constraint team_member_external_type_chk
      check (external_type is null or external_type in ('subcontractor','intelix'));
  end if;
end $$;

-- Backfill del stream: quien esta en un squad -> evolucion; el resto -> operaciones (por tenant).
update public.team_member tm
set delivery_area_id = (
  select da.id from public.delivery_area da
  where da.tenant_id = tm.tenant_id
    and da.code = case
      when exists (select 1 from public.squad_member sm where sm.member_id = tm.id and sm.status <> 'deleted')
        then 'evolution' else 'operations' end
  limit 1
)
where tm.delivery_area_id is null;

-- Invariante: todo profesional pertenece a un stream (operaciones o evolucion).
do $$ begin
  if exists (select 1 from public.team_member where delivery_area_id is null) then
    raise notice 'Hay team_member sin delivery_area_id; se deja nullable para no romper.';
  else
    alter table public.team_member alter column delivery_area_id set not null;
  end if;
end $$;

-- 2) member_evaluation: empatia, tipo y enlace al caso/proyecto evaluado + comentario general.
alter table public.member_evaluation
  add column if not exists eval_type varchar not null default 'general',
  add column if not exists empathy_score numeric,
  add column if not exists comment text,
  add column if not exists entity_type varchar,
  add column if not exists entity_id uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'member_evaluation_type_chk') then
    alter table public.member_evaluation
      add constraint member_evaluation_type_chk
      check (eval_type in ('general','incident','project'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'member_evaluation_scores_chk') then
    alter table public.member_evaluation
      add constraint member_evaluation_scores_chk
      check (
        (performance_score is null or (performance_score >= 0 and performance_score <= 100)) and
        (empathy_score is null or (empathy_score >= 0 and empathy_score <= 100))
      );
  end if;
end $$;

-- 3) Alinear el nombre del responsable de Operaciones (el usuario lo llama "Giselle Arias").
update public.delivery_area set lead_name = 'Giselle Arias', updated_at = now()
where code = 'operations' and lead_name = 'Gissele Arias';

-- 4) Indices de apoyo.
create index if not exists idx_member_skill_member on public.member_skill(member_id);
create index if not exists idx_member_expertise_member on public.member_expertise(member_id);
create index if not exists idx_member_evaluation_member on public.member_evaluation(member_id);
create index if not exists idx_team_member_area on public.team_member(delivery_area_id);
