-- 0103 — Knowledge al cierre: enlaza el articulo a su entidad de origen (ademas de incidente/
-- problema, que ya existen). Al cerrar un caso/mejora/cambio/incidente mayor/proyecto se registra
-- un articulo (draft, tipo known_error) con el caso y su solucion para reuso. Idempotente por origen.

alter table public.knowledge_article
  add column if not exists source_project_id uuid references public.project(id) on delete set null,
  add column if not exists source_change_id uuid references public.change_request(id) on delete set null,
  add column if not exists source_major_incident_id uuid references public.major_incident(id) on delete set null;

-- Un solo articulo por entidad de origen (evita duplicar la captura al cerrar).
create unique index if not exists kb_src_project_uq on public.knowledge_article (source_project_id) where source_project_id is not null;
create unique index if not exists kb_src_change_uq on public.knowledge_article (source_change_id) where source_change_id is not null;
create unique index if not exists kb_src_mi_uq on public.knowledge_article (source_major_incident_id) where source_major_incident_id is not null;

comment on column public.knowledge_article.source_project_id is 'Proyecto/mejora de origen (captura al cierre).';
