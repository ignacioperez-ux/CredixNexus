-- 0097 — §10.4 (control de duplicados, capa BD): email unico por tenant en team_member.
-- Parcial: solo cuando hay email y el registro no esta borrado. Case-insensitive. Se crea solo
-- si NO hay duplicados actuales (evita que la migracion falle con datos sucios; la capa de
-- servicio en lib/talent/actions.ts ya bloquea nuevos duplicados de todas formas).
-- FIX replay-safe (2026-07-16): la columna email no la crea ninguna migracion trackeada
-- (drift: se agrego ad-hoc en produccion). Se crea aqui con IF NOT EXISTS para que la
-- migracion re-aplique limpio sobre una BD fresca (branch/CI/clon-PITR).

alter table public.team_member add column if not exists email varchar;

do $$
begin
  if exists (
    select 1 from public.team_member
    where email is not null and btrim(email) <> '' and status <> 'deleted'
    group by tenant_id, lower(btrim(email)) having count(*) > 1
  ) then
    raise notice 'team_member: existen emails duplicados; se omite el indice unico (limpiar antes).';
  else
    create unique index if not exists team_member_email_uq
      on public.team_member (tenant_id, lower(btrim(email)))
      where email is not null and btrim(email) <> '' and status <> 'deleted';
  end if;
end $$;
