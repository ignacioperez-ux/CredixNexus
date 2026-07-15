-- 0097 — §10.4 (control de duplicados, capa BD): email unico por tenant en team_member.
-- Parcial: solo cuando hay email y el registro no esta borrado. Case-insensitive. Se crea solo
-- si NO hay duplicados actuales (evita que la migracion falle con datos sucios; la capa de
-- servicio en lib/talent/actions.ts ya bloquea nuevos duplicados de todas formas).

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
