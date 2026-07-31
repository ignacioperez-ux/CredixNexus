-- ============================================================================
-- Credix Nexus — 0132 — Fix: auditoria de user_role (bug latente) + prerequisito SSO JIT
-- ----------------------------------------------------------------------------
-- HALLAZGO (verificado en BD): user_role tiene el trigger generico trg_audit_user_role ->
-- audit_row_change(), que hace `new.tenant_id` y `new.id`. Pero user_role NO tiene esas
-- columnas (PK compuesta user_id+role_id, sin tenant_id ni id). => TODA mutacion de
-- user_role fallaba con "record new has no field tenant_id" (0 eventos user_role.* en el
-- ledger). Esto rompe: asignacion de roles del admin (admin_set_user_roles), la rama
-- email/password de handle_new_user, y bloquea el JIT del SSO (que asigna partner_user).
--
-- FIX QUIRURGICO: trigger dedicado audit_user_role_change() que deriva el tenant desde la
-- user_account referenciada y ancla el evento al usuario (entity_type='user_role',
-- entity_id=user_id). NO se toca la funcion compartida audit_row_change() (blast radius
-- minimo: solo cambia el trigger de user_role). Preserva la regla audit-grade (§11).
--
-- IDEMPOTENTE (CREATE OR REPLACE + DROP TRIGGER IF EXISTS). ROLLBACK al pie.
-- ============================================================================

create or replace function public.audit_user_role_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
declare
  v_tenant     uuid;
  v_user       uuid;
  v_role       uuid;
  v_payload    jsonb;
  v_actor_type actor_type;
  v_actor_id   uuid;
begin
  if tg_op = 'DELETE' then
    v_user := old.user_id; v_role := old.role_id;
    v_payload := jsonb_build_object('before', to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    v_user := new.user_id; v_role := new.role_id;
    v_payload := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
  else
    v_user := new.user_id; v_role := new.role_id;
    v_payload := jsonb_build_object('after', to_jsonb(new));
  end if;

  select tenant_id into v_tenant from public.user_account where id = v_user;
  -- Sin tenant no se puede anclar al ledger hash-chained: no bloquear la mutacion.
  if v_tenant is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  v_actor_id := coalesce(nullif(current_setting('app.current_actor_id', true), '')::uuid, auth.uid());
  v_actor_type := coalesce(
    nullif(current_setting('app.current_actor_type', true), '')::actor_type,
    case when auth.uid() is not null then 'user'::actor_type else 'system'::actor_type end);

  perform public.append_audit_event(
    v_tenant, v_actor_type, v_actor_id,
    'user_role.' || lower(tg_op), 'user_role', v_user,
    v_payload || jsonb_build_object('role_id', v_role)
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;

comment on function public.audit_user_role_change() is
  'Auditoria de user_role al ledger: deriva el tenant desde user_account (user_role no tiene tenant_id/id).';

drop trigger if exists trg_audit_user_role on public.user_role;
create trigger trg_audit_user_role after insert or update or delete on public.user_role
  for each row execute function public.audit_user_role_change();

-- =============================================================================
-- ROLLBACK (volver al estado previo, con el bug):
--   drop trigger if exists trg_audit_user_role on public.user_role;
--   create trigger trg_audit_user_role after insert or update or delete on public.user_role
--     for each row execute function public.audit_row_change();
--   drop function if exists public.audit_user_role_change();
-- =============================================================================
