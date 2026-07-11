-- ============================================================================
-- Credix Nexus — 0013 — Aprovisionamiento de usuario al registrarse en Auth
-- Al crear un usuario en auth.users, se crea su user_account en el tenant CORE.
-- Asi current_tenant_id() resuelve el tenant y las policies RLS funcionan.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_tenant uuid;
begin
    select id into v_tenant from public.tenant where code = 'CORE' and status = 'active' limit 1;
    if v_tenant is null then
        return new;  -- sin tenant CORE no se aprovisiona (no rompe el signup)
    end if;

    insert into public.user_account (
        tenant_id, auth_user_id, email, username, full_name, identity_provider
    ) values (
        v_tenant, new.id, new.email, new.email,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        'supabase'
    )
    on conflict (tenant_id, email) do update
        set auth_user_id = excluded.auth_user_id,
            status = 'active';

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
