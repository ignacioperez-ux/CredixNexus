-- 0104 — Reclasificacion automatica de squad por membresia (regla del negocio).
-- Al agregar/quitar/cambiar talento en squad_member: si el squad tiene miembros ACTIVOS -> dominio
-- (no transversal); si no tiene -> equipo transversal (enabler). Los squads 'transient' (temporales)
-- NO se tocan (su tipo es deliberado). Idempotente: solo escribe si cambia.

create or replace function public.squad_reclassify_by_membership()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_squads uuid[];
  s uuid;
  v_has boolean;
  v_actor uuid := public.current_account_id();
begin
  v_squads := array(select distinct x from unnest(array[
    case when tg_op in ('INSERT','UPDATE') then new.squad_id end,
    case when tg_op in ('DELETE','UPDATE') then old.squad_id end
  ]) as x where x is not null);

  foreach s in array v_squads loop
    select exists (select 1 from public.squad_member sm where sm.squad_id = s and sm.status = 'active') into v_has;
    if v_has then
      update public.squad
        set is_transversal = false, squad_type = 'domain', updated_at = now(), updated_by = coalesce(v_actor, updated_by)
        where id = s and squad_type <> 'transient' and (is_transversal is distinct from false or squad_type = 'enabler');
    else
      update public.squad
        set is_transversal = true, squad_type = 'enabler', updated_at = now(), updated_by = coalesce(v_actor, updated_by)
        where id = s and squad_type <> 'transient' and (is_transversal is distinct from true or squad_type = 'domain');
    end if;
  end loop;
  return null; -- AFTER trigger
end
$function$;

drop trigger if exists squad_member_reclassify on public.squad_member;
create trigger squad_member_reclassify
  after insert or update or delete on public.squad_member
  for each row execute function public.squad_reclassify_by_membership();

comment on function public.squad_reclassify_by_membership() is
  'Reclasifica el squad por membresia: con miembros activos -> dominio; sin -> enabler. No toca transient.';
