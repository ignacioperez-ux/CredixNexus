-- 0105 — Override manual de la clasificacion de squad. Si type_locked = true, el tipo (dominio/
-- enabler/transient) se fijo a mano y el trigger de reclasificacion por membresia lo RESPETA (no lo
-- cambia). Permite un enabler permanente con gente (p.ej. DevOps/SRE) o un dominio sin gente aun.

alter table public.squad add column if not exists type_locked boolean not null default false;

comment on column public.squad.type_locked is 'true = tipo fijado a mano; el trigger de reclasificacion por membresia no lo cambia.';

-- Trigger actualizado: ademas de saltar transient, salta los squads con type_locked.
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
        where id = s and type_locked = false and squad_type <> 'transient' and (is_transversal is distinct from false or squad_type = 'enabler');
    else
      update public.squad
        set is_transversal = true, squad_type = 'enabler', updated_at = now(), updated_by = coalesce(v_actor, updated_by)
        where id = s and type_locked = false and squad_type <> 'transient' and (is_transversal is distinct from true or squad_type = 'domain');
    end if;
  end loop;
  return null;
end
$function$;
