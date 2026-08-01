-- ============================================================================
-- Credix Nexus — 0134 — Cierre en cascada de casos hijos duplicados (P4.4)
-- ----------------------------------------------------------------------------
-- Cuando un caso PADRE (agrupador) se resuelve o cierra, sus casos HIJO vinculados
-- por incident_duplicate_link (status='active') se cierran automaticamente y se
-- NOTIFICA a cada reportante. Sostiene la deteccion de duplicados del registro (P4):
-- varias personas que reportan lo mismo se "suman" a un caso hijo vinculado, y al
-- resolver el padre todos quedan cerrados y avisados de una sola vez.
--
-- AUDIT-GRADE: cada UPDATE de hijo dispara trg_audit_incident -> append_audit_event
-- (ledger). No se silencia nada. La notificacion queda en public.notification.
--
-- SEGURIDAD/RECURSION: SECURITY DEFINER + search_path fijo. El trigger se dispara al
-- volver a resolver/cerrar (transicion real). Solo cierra hijos ABIERTOS -> idempotente
-- y sin recursion infinita (un hijo ya cerrado no se reprocesa; los hijos son hojas).
--
-- IDEMPOTENTE (CREATE OR REPLACE + DROP TRIGGER IF EXISTS). ROLLBACK al pie.
-- ============================================================================

-- Nueva fuente de enlace: 'self_report' = el propio reportante se sumo a un caso agrupador (P4).
-- Amplia el CHECK existente (manual/ai/lexical) sin perder los valores previos.
alter table public.incident_duplicate_link drop constraint if exists chk_dup_source;
alter table public.incident_duplicate_link add constraint chk_dup_source
  check (source::text = any (array['manual','ai','lexical','self_report']::text[]));

create or replace function public.cascade_close_duplicate_children()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
declare
  v_child record;
  v_now timestamptz := now();
begin
  -- Solo en transicion real a resuelto/cerrado.
  if new.status not in ('resolved', 'closed') then return new; end if;
  if old.status is not distinct from new.status then return new; end if;

  for v_child in
    select i.id, i.reported_by_user_id, i.incident_number
      from public.incident_duplicate_link dl
      join public.incident i on i.id = dl.duplicate_incident_id
     where dl.primary_incident_id = new.id
       and dl.status = 'active'
       and i.tenant_id = new.tenant_id
       and i.status not in ('resolved', 'closed', 'cancelled')   -- solo hijos ABIERTOS (idempotente)
  loop
    -- El hijo queda en 'resolved' (no 'closed') aunque el padre se cierre: conserva la ventana de
    -- evaluacion (CSAT) del reportante para estadisticas. El CSAT lo cierra al enviarse.
    update public.incident
       set status = 'resolved',
           resolved_at = coalesce(resolved_at, v_now),
           resolution_code = coalesce(resolution_code, 'duplicate_parent_resolved'),
           resolution_summary = coalesce(resolution_summary,
             'Resuelto junto con el caso principal ' || new.incident_number || '.'),
           updated_by = new.updated_by,
           updated_at = v_now
     where id = v_child.id;

    -- Notifica al reportante del hijo (si tiene cuenta de usuario).
    if v_child.reported_by_user_id is not null then
      insert into public.notification
        (tenant_id, recipient_user_id, actor_user_id, type, title, body, severity, entity_type, entity_id, link)
      values
        (new.tenant_id, v_child.reported_by_user_id, new.updated_by, 'case_resolved_dup',
         'Tu caso fue resuelto',
         'El caso ' || v_child.incident_number || ' se resolvio junto con ' || new.incident_number || '. Puedes calificar la atencion.',
         'success', 'incident', v_child.id, '/portal/cases/' || v_child.id::text);
    end if;
  end loop;

  return new;
end;
$function$;

comment on function public.cascade_close_duplicate_children() is
  'Cierra en cascada los casos hijo (incident_duplicate_link activos) al resolver/cerrar el padre y notifica a sus reportantes (P4.4).';

-- Trigger functions no se llaman directo -> sin EXECUTE para roles cliente (higiene, cf. 0133).
revoke all on function public.cascade_close_duplicate_children() from public, anon, authenticated;

drop trigger if exists trg_cascade_close_duplicates on public.incident;
create trigger trg_cascade_close_duplicates
  after update of status on public.incident
  for each row execute function public.cascade_close_duplicate_children();

-- =============================================================================
-- ROLLBACK:
--   drop trigger if exists trg_cascade_close_duplicates on public.incident;
--   drop function if exists public.cascade_close_duplicate_children();
-- =============================================================================
