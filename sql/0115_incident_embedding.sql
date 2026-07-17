-- 0115_incident_embedding.sql
-- Fase 3 parte B: similitud SEMANTICA de casos (parafrasis/sinonimos que el lexico no capta).
-- Embeddings gte-small (384 dims) generados on-platform via Edge Function (Supabase.ai). El
-- embedding es dato DERIVADO (indice de busqueda), no una mutacion de negocio: NO va al ledger.
-- Se fusiona como TERCERA senal junto al lexico (Fase 1) y el juicio IA (Fase 2).

create extension if not exists vector with schema extensions;

create table if not exists public.incident_embedding (
  incident_id  uuid primary key references public.incident(id) on delete cascade,
  tenant_id    uuid not null references public.tenant(id),
  embedding    extensions.vector(384),
  content_hash text,          -- hash de title+description: evita regenerar si no cambio
  model        varchar not null default 'gte-small',
  updated_at   timestamptz not null default now()
);

-- Indice ANN coseno (gte-small produce vectores normalizados).
create index if not exists idx_incident_embedding_hnsw
  on public.incident_embedding using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists idx_incident_embedding_tenant
  on public.incident_embedding (tenant_id);

alter table public.incident_embedding enable row level security;
drop policy if exists incident_embedding_isolation on public.incident_embedding;
create policy incident_embedding_isolation on public.incident_embedding for all to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

drop trigger if exists trg_incident_embedding_updated on public.incident_embedding;
create trigger trg_incident_embedding_updated before update on public.incident_embedding
  for each row execute function public.set_updated_at();

-- Busqueda semantica sobre casos ABIERTOS. SECURITY INVOKER: respeta RLS + scope tenant.
-- p_embedding llega como texto '[...]' (supabase-js) y se castea a vector.
create or replace function public.search_incidents_semantic(
  p_embedding text,
  p_exclude   uuid default null,
  p_k         int  default 5
) returns table (incident_id uuid, incident_number text, title text, status text, similarity real)
language sql stable
set search_path = public, extensions
as $$
  select ie.incident_id, i.incident_number, i.title, i.status::text,
         (1 - (ie.embedding <=> p_embedding::extensions.vector))::real as similarity
  from public.incident_embedding ie
  join public.incident i on i.id = ie.incident_id
  where ie.tenant_id = public.current_tenant_id()
    and i.status not in ('resolved','closed','cancelled')
    and ie.embedding is not null
    and (p_exclude is null or ie.incident_id <> p_exclude)
  order by ie.embedding <=> p_embedding::extensions.vector
  limit greatest(1, least(p_k, 20));
$$;
revoke all on function public.search_incidents_semantic(text, uuid, int) from public, anon;
grant execute on function public.search_incidents_semantic(text, uuid, int) to authenticated;

comment on table public.incident_embedding is
  'Embeddings gte-small (384d) de incidentes para similitud semantica. Dato derivado (no ledger).';
