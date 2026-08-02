-- ============================================================================
-- Credix Nexus — 0135 — RLS por DUENO para usuarios externos (partner_user) [P0/S1]
-- ----------------------------------------------------------------------------
-- REMEDIACION del hallazgo CRITICO S1 de la validacion: las tablas con PII/datos de
-- caso tenian una unica politica `cmd=ALL` para `authenticated` con USING/WITH CHECK =
-- (tenant_id = current_tenant_id()) — sin aislamiento por fila. Cualquier autenticado
-- del tenant (incl. `partner_user` externo) podia LEER y ESCRIBIR todas las filas del
-- tenant con la anon key publica, saltandose la app.
--
-- ENFOQUE DE MINIMA REGRESION: se restringe SOLO a los usuarios externos PUROS
-- (cuenta con exactamente 1 rol = partner_user) a sus propias filas. TODO rol interno
-- conserva el acceso actual (tenant-wide) -> CERO cambio para staff (61 cuentas). Solo
-- cambian los 16 partner_user puros. Predicado unico por tabla:
--     (tenant_id = current_tenant_id()) AND (NOT is_external_partner() OR <dueno>)
-- Aplica a USING (lectura/visibilidad + filas actualizables/borrables) y a WITH CHECK
-- (insert/update validos): un partner solo ve/escribe lo suyo; un interno, todo el tenant.
--
-- Los RPC del portal (add_my_case_comment, submit_case_csat, get_my_case*) son SECURITY
-- DEFINER y NO dependen de RLS -> siguen funcionando. createIncident / uploadMyCaseEvidence
-- insertan con reported_by/incident_id/uploaded_by propios -> pasan el WITH CHECK.
--
-- REGRESION MENOR CONOCIDA: en el listado directo del portal ("Mis casos"/inbox), el
-- nombre del asignado (join a user_account de un staff) quedara nulo para el partner
-- (el detalle si lo muestra via RPC). Se puede exponer luego por un RPC de solo-nombre.
--
-- SEGURIDAD: is_external_partner() SECURITY DEFINER + STABLE + search_path fijo, EXECUTE
-- revocado a public/anon. IDEMPOTENTE. ROLLBACK al pie (restaura politicas tenant-wide).
-- ============================================================================

-- ---- Clasificador de usuario externo puro (exactamente 1 rol y es partner_user) ----
create or replace function public.is_external_partner()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public', 'auth'
as $function$
  select
    exists (
      select 1 from public.user_account ua
        join public.user_role ur on ur.user_id = ua.id
        join public.role r on r.id = ur.role_id
       where ua.auth_user_id = auth.uid() and r.code = 'partner_user'
    )
    and (
      select count(*) from public.user_role ur
        join public.user_account ua on ua.id = ur.user_id
       where ua.auth_user_id = auth.uid()
    ) = 1;
$function$;
comment on function public.is_external_partner() is
  'true si el usuario autenticado es un partner externo PURO (unico rol = partner_user). Usado por RLS para acotar sus datos a los propios sin afectar a roles internos.';
revoke all on function public.is_external_partner() from public, anon;

-- Helper de subconsulta: ids de incidentes reportados por la cuenta actual.
-- (Se referencia inline en las politicas de tablas hijas de incident.)

-- ---- incident ----
drop policy if exists incident_isolation on public.incident;
create policy incident_isolation on public.incident for all to authenticated
  using (tenant_id = current_tenant_id() and (not public.is_external_partner() or reported_by_user_id = current_account_id()))
  with check (tenant_id = current_tenant_id() and (not public.is_external_partner() or reported_by_user_id = current_account_id()));

-- ---- incident_comment (dueno = comentario en un caso propio) ----
drop policy if exists incident_comment_isolation on public.incident_comment;
create policy incident_comment_isolation on public.incident_comment for all to authenticated
  using (tenant_id = current_tenant_id() and (not public.is_external_partner()
    or incident_id in (select i.id from public.incident i where i.reported_by_user_id = current_account_id())))
  with check (tenant_id = current_tenant_id() and (not public.is_external_partner()
    or incident_id in (select i.id from public.incident i where i.reported_by_user_id = current_account_id())));

-- ---- case_attachment (dueno = adjunto de un caso propio o subido por mi) ----
drop policy if exists case_attachment_isolation on public.case_attachment;
create policy case_attachment_isolation on public.case_attachment for all to authenticated
  using (tenant_id = current_tenant_id() and (not public.is_external_partner()
    or uploaded_by = current_account_id()
    or incident_id in (select i.id from public.incident i where i.reported_by_user_id = current_account_id())))
  with check (tenant_id = current_tenant_id() and (not public.is_external_partner()
    or uploaded_by = current_account_id()
    or incident_id in (select i.id from public.incident i where i.reported_by_user_id = current_account_id())));

-- ---- case_survey (CSAT del caso propio) ----
drop policy if exists case_survey_isolation on public.case_survey;
create policy case_survey_isolation on public.case_survey for all to public
  using (tenant_id = current_tenant_id() and (not public.is_external_partner()
    or incident_id in (select i.id from public.incident i where i.reported_by_user_id = current_account_id())))
  with check (tenant_id = current_tenant_id() and (not public.is_external_partner()
    or incident_id in (select i.id from public.incident i where i.reported_by_user_id = current_account_id())));

-- ---- case_work_log (notas internas: el partner NO ve ni escribe) ----
drop policy if exists case_work_log_isolation on public.case_work_log;
create policy case_work_log_isolation on public.case_work_log for all to public
  using (tenant_id = current_tenant_id() and not public.is_external_partner())
  with check (tenant_id = current_tenant_id() and not public.is_external_partner());

-- ---- party (PII: el partner solo su propia party) ----
drop policy if exists party_isolation on public.party;
create policy party_isolation on public.party for all to authenticated
  using (tenant_id = current_tenant_id() and (not public.is_external_partner()
    or id = (select ua.party_id from public.user_account ua where ua.auth_user_id = auth.uid())))
  with check (tenant_id = current_tenant_id() and (not public.is_external_partner()
    or id = (select ua.party_id from public.user_account ua where ua.auth_user_id = auth.uid())));

-- ---- user_account (el partner solo su propia cuenta) ----
drop policy if exists user_account_isolation on public.user_account;
create policy user_account_isolation on public.user_account for all to authenticated
  using (tenant_id = current_tenant_id() and (not public.is_external_partner() or auth_user_id = auth.uid()))
  with check (tenant_id = current_tenant_id() and (not public.is_external_partner() or auth_user_id = auth.uid()));

-- ---- fraud_case / dispute_case (casos internos sensibles: el partner NO ve) ----
drop policy if exists fraud_isolation on public.fraud_case;
create policy fraud_isolation on public.fraud_case for all to authenticated
  using (tenant_id = current_tenant_id() and not public.is_external_partner())
  with check (tenant_id = current_tenant_id() and not public.is_external_partner());

drop policy if exists dispute_isolation on public.dispute_case;
create policy dispute_isolation on public.dispute_case for all to authenticated
  using (tenant_id = current_tenant_id() and not public.is_external_partner())
  with check (tenant_id = current_tenant_id() and not public.is_external_partner());

-- =============================================================================
-- ROLLBACK (restaurar aislamiento SOLO por tenant, estado previo a 0135):
--   -- por cada tabla: drop policy ...; create policy <name> for all to <role>
--   --   using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
--   -- drop function if exists public.is_external_partner();
-- =============================================================================
