-- 0073_dashboard_counts_fn.sql
-- Consolida los 5 conteos del dashboard en UNA sola RPC (menos viajes a Supabase por render).
-- SECURITY INVOKER: respeta la RLS del usuario que llama, identico a los conteos directos previos.

create or replace function public.dashboard_counts()
returns jsonb
language sql
stable
security invoker
set search_path to 'public'
as $$
  select jsonb_build_object(
    'apps',      (select count(*) from public.configuration_item where ci_type = 'application'),
    'systems',   (select count(*) from public.configuration_item where ci_type = 'system'),
    'processes', (select count(*) from public.process),
    'products',  (select count(*) from public.product),
    'ledger',    (select count(*) from public.immutable_audit_event)
  );
$$;

grant execute on function public.dashboard_counts() to authenticated, anon;
