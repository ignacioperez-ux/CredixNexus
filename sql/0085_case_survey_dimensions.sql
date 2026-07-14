-- 0085_case_survey_dimensions.sql
-- CSAT por dimensiones (P4): el usuario califica 1..5 en Resolucion, Rapidez y Atencion,
-- con comentario. 1 a 1 (un caso, una evaluacion; unico por incidente ya existente).
-- score se mantiene como puntaje general (promedio de las dimensiones al enviar).

alter table public.case_survey
  add column if not exists q_resolution smallint,
  add column if not exists q_speed      smallint,
  add column if not exists q_attention  smallint;

alter table public.case_survey drop constraint if exists case_survey_q_resolution_chk;
alter table public.case_survey add constraint case_survey_q_resolution_chk
  check (q_resolution is null or q_resolution between 1 and 5);

alter table public.case_survey drop constraint if exists case_survey_q_speed_chk;
alter table public.case_survey add constraint case_survey_q_speed_chk
  check (q_speed is null or q_speed between 1 and 5);

alter table public.case_survey drop constraint if exists case_survey_q_attention_chk;
alter table public.case_survey add constraint case_survey_q_attention_chk
  check (q_attention is null or q_attention between 1 and 5);

comment on column public.case_survey.q_resolution is 'CSAT dimension: se resolvio el caso (1..5)';
comment on column public.case_survey.q_speed is 'CSAT dimension: rapidez/oportunidad (1..5)';
comment on column public.case_survey.q_attention is 'CSAT dimension: trato/atencion (1..5)';
