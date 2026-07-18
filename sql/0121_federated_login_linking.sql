-- 0121_federated_login_linking.sql
-- SSO Entra ID (FASE PREPARATORIA, DORMIDA): vinculacion de identidad federada a un
-- user_account PRE-APROVISIONADO. No activa SSO por si sola: el proveedor Azure se
-- configura en el dashboard el dia D y el frontend queda tras feature flag.
--
-- CONTEXTO / CHOQUE RESUELTO (Gate 0, decision del arquitecto):
--   El trigger existente on_auth_user_created -> handle_new_user() AUTO-CREA cuentas (JIT):
--   ante cualquier alta en auth.users inserta user_account (o vincula por email) y asigna rol
--   (tenant_admin al 1o, support_agent al resto). Eso CONTRADICE el pre-aprovisionamiento
--   estricto del SSO. Un 2o trigger no bastaria (el JIT seguiria creando). Decision aprobada:
--   hacer handle_new_user() PROVIDER-AWARE en una sola funcion / un solo trigger.
--
-- COMPORTAMIENTO:
--   * Identidad AZURE (federada): SOLO vincula-si-existe. Busca user_account ACTIVO por email
--     (citext, case-insensitive) y, si el vinculo esta libre o ya es de este mismo auth user,
--     setea auth_user_id + identity_provider='azure' + external_subject(oid/sub) + last_login_at.
--     NO crea cuentas (pre-aprovisionamiento estricto). NO asigna roles (van pre-aprovisionados).
--     NO toca password_auth_disabled (esa es decision por-usuario del dia D, via runbook).
--     Conflicto (la cuenta ya esta vinculada a OTRO auth_user_id): NO sobreescribe (no vincula).
--     No-match (email sin cuenta previa): NO crea. Rastro del intento = auth.audit_log_entries
--     (nativo de Supabase) + la solicitud SI_SOLICITUD_ACCESO que crea el propio usuario en la
--     pantalla "sin acceso" (el ledger hash-chained no admite un intento sin tenant/entidad).
--   * Identidad NO federada (email/password/supabase = flujo actual): comportamiento INTACTO,
--     solo en INSERT (create-or-link + rol), idem a hoy.
--
-- SEGURIDAD: SECURITY DEFINER + search_path fijado. NO toca tablas, NO toca RLS, NO toca grants.
-- IDEMPOTENTE: CREATE OR REPLACE + DROP TRIGGER IF EXISTS. Re-ejecutable sin efecto adverso.
--
-- ROLLBACK (volver a hoy): restaurar la version previa de handle_new_user() (create-or-link + rol,
--   sin rama azure) y volver el trigger a AFTER INSERT. Bloque de reversa al pie de este archivo.

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
declare
  v_tenant uuid;
  v_user uuid;
  v_role uuid;
  v_is_first boolean;
  v_provider text := coalesce(new.raw_app_meta_data->>'provider', 'email');
  v_subject text;
begin
  ----------------------------------------------------------------------------
  -- RAMA FEDERADA (Azure/Entra ID): vincular-si-existe, sin crear, sin rol.
  ----------------------------------------------------------------------------
  if v_provider = 'azure' then
    -- En UPDATE, solo actuar cuando cambia el sign-in (evita trabajo en refrescos irrelevantes).
    if tg_op = 'UPDATE' and new.last_sign_in_at is not distinct from old.last_sign_in_at then
      return new;
    end if;

    v_subject := coalesce(new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'sub');

    update public.user_account ua
       set auth_user_id     = new.id,
           identity_provider = 'azure',
           external_subject  = coalesce(v_subject, ua.external_subject),
           last_login_at     = now()
     where ua.email = new.email                        -- citext: match case-insensitive
       and ua.status = 'active'
       and (ua.auth_user_id is null or ua.auth_user_id = new.id);  -- conflict-safe: no pisa otro vinculo

    -- No-match => NO crear (pre-aprovisionamiento estricto). Sin rastro en el ledger hash-chained.
    return new;
  end if;

  ----------------------------------------------------------------------------
  -- RAMA NO FEDERADA (email/password/supabase): comportamiento ACTUAL, intacto, solo INSERT.
  ----------------------------------------------------------------------------
  if tg_op <> 'INSERT' then
    return new;
  end if;

  select id into v_tenant from public.tenant where code = 'CORE' and status = 'active' limit 1;
  if v_tenant is null then return new; end if;

  insert into public.user_account (tenant_id, auth_user_id, email, username, full_name, identity_provider)
  values (v_tenant, new.id, new.email, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'supabase')
  on conflict (tenant_id, email) do update set auth_user_id = excluded.auth_user_id, status = 'active'
  returning id into v_user;

  -- primer usuario del tenant -> tenant_admin, resto -> support_agent
  select count(*) = 1 into v_is_first from public.user_account where tenant_id = v_tenant;
  select id into v_role from public.role
    where tenant_id is null and code = case when v_is_first then 'tenant_admin' else 'support_agent' end;
  if v_user is not null and v_role is not null then
    insert into public.user_role (user_id, role_id) values (v_user, v_role) on conflict do nothing;
  end if;

  return new;
end;
$function$;

-- El trigger pasa de AFTER INSERT a AFTER INSERT OR UPDATE (para refrescar el vinculo azure en re-login).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- ROLLBACK (ejecutar SOLO para volver al estado previo a esta migracion):
-- =============================================================================
-- create or replace function public.handle_new_user()
--  returns trigger language plpgsql security definer set search_path to 'public','auth'
-- as $function$
-- declare v_tenant uuid; v_user uuid; v_role uuid; v_is_first boolean;
-- begin
--     select id into v_tenant from public.tenant where code='CORE' and status='active' limit 1;
--     if v_tenant is null then return new; end if;
--     insert into public.user_account (tenant_id, auth_user_id, email, username, full_name, identity_provider)
--     values (v_tenant, new.id, new.email, new.email,
--             coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), 'supabase')
--     on conflict (tenant_id, email) do update set auth_user_id=excluded.auth_user_id, status='active'
--     returning id into v_user;
--     select count(*) = 1 into v_is_first from public.user_account where tenant_id=v_tenant;
--     select id into v_role from public.role where tenant_id is null and code = case when v_is_first then 'tenant_admin' else 'support_agent' end;
--     if v_user is not null and v_role is not null then
--         insert into public.user_role (user_id, role_id) values (v_user, v_role) on conflict do nothing;
--     end if;
--     return new;
-- end; $function$;
-- drop trigger if exists on_auth_user_created on auth.users;
-- create trigger on_auth_user_created after insert on auth.users
--   for each row execute function public.handle_new_user();
