-- 0094 — Fase Evolucion 1.4: resultados reales del proyecto (ROI real vs estimado).
-- El portafolio ya tiene beneficio/costo ESTIMADO; para comparar ROI real vs estimado se
-- capturan los montos REALES al ejecutar/cerrar. Nullable (desconocido hasta medirse) + no
-- negativos. WSJF y ROI estimado ya existen; esto solo agrega el lado "real".

alter table public.project
  add column if not exists actual_benefit_amount numeric,
  add column if not exists actual_cost_amount numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_actual_benefit_nonneg') then
    alter table public.project add constraint project_actual_benefit_nonneg
      check (actual_benefit_amount is null or actual_benefit_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'project_actual_cost_nonneg') then
    alter table public.project add constraint project_actual_cost_nonneg
      check (actual_cost_amount is null or actual_cost_amount >= 0);
  end if;
end $$;

comment on column public.project.actual_benefit_amount is 'Beneficio real medido (ROI real). Null hasta capturarse.';
comment on column public.project.actual_cost_amount is 'Costo real incurrido (ROI real). Null hasta capturarse.';
