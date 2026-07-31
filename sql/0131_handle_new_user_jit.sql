-- ============================================================================
-- Credix Nexus — 0131 — handle_new_user() v3: JIT por dominio para SSO (Entra ID)
-- ----------------------------------------------------------------------------
-- Extiende la RAMA FEDERADA (azure) de handle_new_user() (v2 en 0121):
--   1) vincular-si-existe por email (comportamiento v2, intacto), y
--   2) si el email NO tiene NINGUNA cuenta y su dominio esta en sso_allowed_domain
--      ACTIVO (0130): APROVISIONA JIT -> crea user_account en el tenant mapeado +
--      asigna el default_role (partner_user) + registra evento de ledger explicito
--      'user.provisioned_sso' (audit-grade, CLAUDE.md §11).
--
-- CONFLICT-SAFE (se conserva el invariante del diseño):
--   * Si la cuenta existe y esta libre/es de este auth user -> se VINCULA (no JIT).
--   * Si la cuenta existe pero esta vinculada a OTRO auth_user_id, o no esta 'active'
--     -> NO se toca y NO se aprovisiona (cae a /no-access). El JIT solo corre cuando
--     NO existe cuenta alguna para ese email (evita pisar cuentas internas).
--   * Si el dominio no esta permitido -> NO se crea (pre-aprovisionamiento estricto).
--   * El JIT SOLO otorga el default_role del dominio (partner_user): nunca roles internos.
--
-- AUDIT-GRADE: el INSERT en user_account ya dispara trg_audit_user (ledger). Ademas
--   se añade un evento semantico 'user.provisioned_sso'. Si el ledger no puede
--   escribir, la transaccion falla y revierte (comportamiento correcto, §11).
--
-- La RAMA NO FEDERADA (email/password) queda BYTE-IDENTICA a v2 (0121).
-- SECURITY DEFINER + search_path fijado. IDEMPOTENTE. ROLLBACK a v2 al pie.
-- ============================================================================

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
  v_domain text;
begin
  ----------------------------------------------------------------------------
  -- RAMA FEDERADA (Azure/Entra ID): vincular-si-existe; si no existe, JIT por dominio.
  ----------------------------------------------------------------------------
  if v_provider = 'azure' then
    -- En UPDATE, solo actuar cuando cambia el sign-in (evita trabajo en refrescos irrelevantes).
    if tg_op = 'UPDATE' and new.last_sign_in_at is not distinct from old.last_sign_in_at then
      return new;
    end if;

    v_subject := coalesce(new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'sub');

    -- (1) Vincular-si-existe (cuenta pre-aprovisionada). Conflict-safe: no pisa otro vinculo.
    update public.user_account ua
       set auth_user_id     = new.id,
           identity_provider = 'azure',
           external_subject  = coalesce(v_subject, ua.external_subject),
           last_login_at     = now()
     where ua.email = new.email
       and ua.status = 'active'
       and (ua.auth_user_id is null or ua.auth_user_id = new.id);

    -- (2) JIT: solo si NO existe NINGUNA cuenta para ese email (no pisa cuentas internas ni
    --     resucita suspendidas) y el dominio esta permitido y activo.
    if not found and not exists (select 1 from public.user_account where email = new.email) then
      v_domain := lower(split_part(new.email, '@', 2));

      select d.tenant_id, d.default_role_id
        into v_tenant, v_role
        from public.sso_allowed_domain d
       where d.domain = v_domain
         and d.status = 'active'
       limit 1;

      if v_tenant is not null then
        insert into public.user_account (tenant_id, auth_user_id, email, username, full_name,
                                         identity_provider, external_subject, last_login_at)
        values (v_tenant, new.id, new.email, new.email,
                coalesce(new.raw_user_meta_data->>'full_name',
                         new.raw_user_meta_data->>'name',
                         split_part(new.email, '@', 1)),
                'azure', v_subject, now())
        returning id into v_user;

        -- Rol JIT: el default del dominio; si faltara, fallback a partner_user global (minimo privilegio).
        if v_role is null then
          select id into v_role from public.role where tenant_id is null and code = 'partner_user' limit 1;
        end if;
        if v_user is not null and v_role is not null then
          insert into public.user_role (user_id, role_id) values (v_user, v_role) on conflict do nothing;
        end if;

        -- Evento de ledger EXPLICITO de aprovisionamiento SSO (ademas del trg_audit_user automatico).
        if v_user is not null then
          perform public.append_audit_event(
            v_tenant, 'system'::actor_type, null,
            'user.provisioned_sso', 'user_account', v_user,
            jsonb_build_object(
              'email', new.email::text,
              'identity_provider', 'azure',
              'domain', v_domain,
              'role_id', v_role,
              'external_subject', v_subject
            )
          );
        end if;
      end if;
      -- Dominio no permitido => NO crea (el callback enruta a /no-access; el usuario puede solicitar acceso).
    end if;

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

-- El trigger ya es AFTER INSERT OR UPDATE (0121); se reafirma por idempotencia.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- ROLLBACK (volver a v2, sin JIT): re-ejecutar sql/0121_federated_login_linking.sql.
-- =============================================================================
