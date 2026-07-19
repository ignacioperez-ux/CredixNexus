"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { ErrorCode, required, minLength, firstError } from "@/lib/validation";
import { derivePriority, type Impact, type Urgency } from "@/lib/incidents/priority";
import { requiresAssignee, assignmentGuard } from "@/lib/incidents/transitions";
import { assertActOnIncident } from "@/lib/auth/incident-authz";
import { findSimilarOpenCases, type SimilarDraft, type SimilarCaseHit } from "@/lib/incidents/similar";
import { searchKnowledge, type SearchResult } from "@/lib/portal/queries";
import { embedQuery, triggerIncidentEmbedding, type SemanticHit } from "@/lib/ai/embeddings";

export type ActionResult = { ok: boolean; error?: string; id?: string; number?: string };

/** Guard de permiso: pasa si es admin o tiene AL MENOS uno de los codigos. Defense-in-depth
 *  para las mutaciones de incidencia (antes solo dependian de RLS + gate de UI). */
async function anyPerm(codes: string[]): Promise<boolean> {
  const access = await getAccessControl();
  return access.isAdmin || codes.some((c) => access.perms.includes(c));
}

const PRIORITIES = ["p1_critical", "p2_high", "p3_medium", "p4_low"];

/** Prioridad manual (override del gerente). FASE 3.1: valida permiso en servidor (incident.update);
 *  auditado por trigger. La prioridad derivada de impacto/urgencia se mantiene salvo override. */
export async function setPriority(incidentId: string, priority: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  // La prioridad la decide la Gerencia (asignar/triar). El Operador no cambia prioridad.
  if (!(await anyPerm(["incident.assign", "triage.manage"]))) return { ok: false, error: ErrorCode.PERMISSION };
  if (!PRIORITIES.includes(priority)) return { ok: false, error: ErrorCode.FORMAT };
  const { error } = await ctx.supabase.from("incident").update({ priority }).eq("id", incidentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/incidents");
  return { ok: true };
}

export type IncidentInput = {
  title: string;
  description: string;
  categoryId: string;
  affectedCiId?: string;
  affectedServiceId?: string;
  affectedProductId?: string;
  affectedChannelId?: string;
  affectedBusinessUnitId?: string;
  impact: Impact;
  urgency: Urgency;
  financialImpactEstimate?: number;
  // Capa fintech
  caseType?: string;
  amount?: number | null;
  currency?: string;
  transactionReference?: string;
  customerName?: string;
  sensitiveFlag?: boolean;
  piiFlag?: boolean;
  // Reincidencia: el usuario indica que reincide un caso previo cuyo fix no funciono.
  isRecurrence?: boolean;
  recurrenceOfIncidentId?: string;
};

function fintechCols(i: IncidentInput) {
  return {
    case_type: i.caseType || "Incident",
    amount: i.amount != null && !Number.isNaN(i.amount) ? i.amount : null,
    currency: i.currency || "CRC",
    transaction_reference: orNull(i.transactionReference),
    customer_name: orNull(i.customerName),
    sensitive_flag: !!i.sensitiveFlag,
    pii_flag: !!i.piiFlag,
  };
}

const LEVELS = ["critical", "high", "medium", "low"];

// Validacion backend (espejo del frontend + constraints de BD). CLAUDE.md §10.7.
function validateInput(i: IncidentInput): string | null {
  const financial = i.financialImpactEstimate ?? 0;
  return firstError(
    minLength(i.title, 5),
    minLength(i.description, 10),
    required(i.categoryId),
    LEVELS.includes(i.impact) ? null : ErrorCode.FORMAT,
    LEVELS.includes(i.urgency) ? null : ErrorCode.FORMAT,
    financial < 0 ? ErrorCode.FORMAT : null,
  );
}

const orNull = (v?: string) => (v && v.length > 0 ? v : null);

export async function createIncident(input: IncidentInput): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  // Defense-in-depth (antes solo dependia de RLS + tenant): solo quien trabaja casos puede crearlos.
  // Set inclusivo para no degradar roles actuales (R1): portal/partner (incident.create), agentes y
  // leads (update/resolve/triage). Bloquea a usuarios autenticados sin permisos de caso.
  if (!(await anyPerm(["incident.create", "incident.update", "incident.resolve", "triage.manage"]))) {
    return { ok: false, error: ErrorCode.PERMISSION };
  }

  const err = validateInput(input);
  if (err) return { ok: false, error: err };

  const { data: cat } = await ctx.supabase
    .from("incident_category")
    .select("code")
    .eq("id", input.categoryId)
    .maybeSingle();

  const priority = derivePriority(input.impact, input.urgency);

  // Reincidencia: si se enlaza un caso previo, verificar que existe en el tenant (RLS). Si no
  // se encuentra, se guarda la marca pero sin enlace (no bloquea el registro del caso).
  let recurrenceOf: string | null = null;
  if (input.isRecurrence && input.recurrenceOfIncidentId) {
    const { data: prior } = await ctx.supabase.from("incident").select("id").eq("id", input.recurrenceOfIncidentId).maybeSingle();
    recurrenceOf = prior ? (prior.id as string) : null;
  }

  const { data, error } = await ctx.supabase
    .from("incident")
    .insert({
      tenant_id: ctx.tenantId,
      title: input.title.trim(),
      description: input.description.trim(),
      category: (cat?.code as string | undefined)?.toLowerCase() ?? "general",
      category_id: input.categoryId,
      affected_ci_id: orNull(input.affectedCiId),
      affected_service_id: orNull(input.affectedServiceId),
      affected_product_id: orNull(input.affectedProductId),
      affected_channel_id: orNull(input.affectedChannelId),
      affected_business_unit_id: orNull(input.affectedBusinessUnitId),
      impact: input.impact,
      urgency: input.urgency,
      priority,
      financial_impact_estimate: input.financialImpactEstimate ?? 0,
      reported_by_user_id: ctx.accountId,
      status: "new",
      is_recurrence: !!input.isRecurrence,
      recurrence_of_incident_id: recurrenceOf,
      ...fintechCols(input),
    })
    .select("id, incident_number")
    .single();

  if (error) return { ok: false, error: error.message };
  // Embedding semantico (fire-and-forget): no bloquea el registro.
  void triggerIncidentEmbedding(ctx.supabase, data.id as string);
  revalidatePath("/incidents");
  return { ok: true, id: data.id as string, number: data.incident_number as string };
}

/** Cambia el flag de reincidencia despues del registro. Solo el REPORTANTE (libre, es su
 *  afirmacion) o la GERENCIA de Operaciones pueden cambiarlo; la Gerencia DEBE documentar el
 *  motivo (evidencia para discusiones posteriores). Backend-authoritative (§10.7/§10.8). La
 *  justificacion queda en columna + comentario de sistema, ademas del ledger (audit_row_change). */
export async function setIncidentRecurrence(incidentId: string, isRecurrence: boolean, reviewNote?: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  const { data: inc } = await ctx.supabase.from("incident").select("reported_by_user_id, is_recurrence").eq("id", incidentId).maybeSingle();
  if (!inc) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const isReporter = inc.reported_by_user_id === ctx.accountId;
  // Gerencia de Operaciones (no operador): mismas potestades que triar/asignar (cf. sendToEvolution).
  const isOpsMgr = await anyPerm(["triage.manage", "incident.assign"]);
  if (!isReporter && !isOpsMgr) return { ok: false, error: ErrorCode.PERMISSION };

  const note = (reviewNote ?? "").trim();
  // Si lo cambia la Gerencia (no el reportante), el motivo es OBLIGATORIO (evidencia documentada).
  if (!isReporter && note.length < 5) return { ok: false, error: "RECURRENCE_REASON_REQUIRED" };
  if (inc.is_recurrence === isRecurrence && !(!isReporter && note)) return { ok: true, id: incidentId };

  const patch: Record<string, unknown> = { is_recurrence: isRecurrence, updated_by: ctx.accountId };
  if (!isReporter) {
    patch.recurrence_review_note = note;
    patch.recurrence_reviewed_by = ctx.accountId;
    patch.recurrence_reviewed_at = new Date().toISOString();
  }
  const { error } = await ctx.supabase.from("incident").update(patch).eq("id", incidentId);
  if (error) return { ok: false, error: error.message };

  await ctx.supabase.from("incident_comment").insert({
    tenant_id: ctx.tenantId, incident_id: incidentId, author_user_id: ctx.accountId,
    body: `Reincidencia ${isRecurrence ? "marcada" : "desmarcada"}${note ? ` — motivo: ${note}` : ""}.`,
    visibility: "internal", is_system_generated: true,
  });
  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath(`/portal/cases/${incidentId}`);
  return { ok: true, id: incidentId };
}

export type SimilarResult = { ok: boolean; error?: string; items?: SimilarCaseHit[] };

/** Deteccion de duplicados en el registro (mesa de ayuda): casos ABIERTOS del tenant
 *  similares al borrador. Solo LECTURA -> sin evento de ledger (no hay mutacion de negocio).
 *  Mismo guard que createIncident. Sugiere sin bloquear (§11). */
export async function checkSimilarCases(draft: SimilarDraft): Promise<SimilarResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await anyPerm(["incident.create", "incident.update", "incident.resolve", "triage.manage"]))) {
    return { ok: false, error: ErrorCode.PERMISSION };
  }
  const items = await findSimilarOpenCases(ctx.supabase, draft);
  return { ok: true, items };
}

/** Deteccion de duplicados para el usuario final del portal: acotada a SUS PROPIOS casos
 *  abiertos (no expone casos de otros usuarios del tenant). Solo lectura. */
export async function checkMySimilarCases(draft: SimilarDraft): Promise<SimilarResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId || !ctx.accountId) return { ok: false, error: ErrorCode.PERMISSION };
  const items = await findSimilarOpenCases(ctx.supabase, draft, { ownerId: ctx.accountId });
  return { ok: true, items };
}

/** Busqueda a demanda de conocimiento reutilizable en el registro (mesa de ayuda): casos
 *  RESUELTOS + articulos KB similares al borrador (mismo motor lexico del portal). Solo lectura.
 *  Complementa el panel de duplicados ABIERTOS: aqui el foco es reusar una solucion documentada. */
export async function searchResolvedSimilar(query: string): Promise<{ ok: boolean; error?: string; result?: SearchResult }> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await anyPerm(["incident.create", "incident.update", "incident.resolve", "triage.manage"]))) {
    return { ok: false, error: ErrorCode.PERMISSION };
  }
  const result = await searchKnowledge(ctx.supabase, query);
  return { ok: true, result };
}

export type SemanticResult = { ok: boolean; error?: string; items?: SemanticHit[] };

/** Similitud SEMANTICA (Fase 3-B): embebe el borrador (Edge Function gte-small) y busca por
 *  distancia coseno sobre casos abiertos con embedding. Tercera senal, complementa lexico + IA.
 *  Si no hay embeddings aun (backfill pendiente) o la funcion falla, devuelve lista vacia. */
export async function findSimilarSemantic(draft: { title: string; description?: string }, excludeId?: string): Promise<SemanticResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await anyPerm(["incident.create", "incident.update", "incident.resolve", "triage.manage"]))) {
    return { ok: false, error: ErrorCode.PERMISSION };
  }
  const vec = await embedQuery(ctx.supabase, `${draft.title} ${draft.description ?? ""}`);
  if (!vec) return { ok: true, items: [] };
  const { data, error } = await ctx.supabase.rpc("search_incidents_semantic", {
    p_embedding: JSON.stringify(vec),
    p_exclude: excludeId ?? null,
    p_k: 5,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, items: (data ?? []) as SemanticHit[] };
}

/** Marca un caso como DUPLICADO de otro (canonico). Fase 3: decision humana de Gerencia
 *  (triage.manage/incident.assign). No destructivo: NO cierra el caso (client-centric). Audit-grade:
 *  el trigger del ledger registra el enlace (actor = auth.uid()); si el ledger falla, se revierte. */
export async function markDuplicate(
  duplicateId: string,
  primaryId: string,
  opts?: { source?: "manual" | "ai" | "lexical"; confidence?: number | null; reason?: string | null },
): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  // Marcar duplicado es gestion (como derivar a Evolucion), no del Operador.
  if (!(await anyPerm(["incident.assign", "triage.manage"]))) return { ok: false, error: ErrorCode.PERMISSION };
  if (!duplicateId || !primaryId || duplicateId === primaryId) return { ok: false, error: ErrorCode.FORMAT };

  // Ambos casos deben existir en el tenant (RLS ya acota; validamos para mensaje claro).
  const { data: incs } = await ctx.supabase.from("incident").select("id").in("id", [duplicateId, primaryId]);
  if (!incs || incs.length < 2) return { ok: false, error: ErrorCode.INVALID_REFERENCE };

  const { data, error } = await ctx.supabase
    .from("incident_duplicate_link")
    .insert({
      tenant_id: ctx.tenantId,
      duplicate_incident_id: duplicateId,
      primary_incident_id: primaryId,
      source: opts?.source ?? "manual",
      confidence: opts?.confidence ?? null,
      reason: orNull(opts?.reason ?? undefined),
      created_by: ctx.accountId,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    // Violacion del indice unico parcial: el caso ya tiene un primario activo.
    if (error.code === "23505") return { ok: false, error: ErrorCode.DUPLICATE };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/incidents/${duplicateId}`);
  revalidatePath(`/incidents/${primaryId}`);
  return { ok: true, id: data.id as string };
}

/** Revoca un enlace de duplicado (soft: status=revoked). Gestion. Auditado por trigger. */
export async function revokeDuplicate(linkId: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await anyPerm(["incident.assign", "triage.manage"]))) return { ok: false, error: ErrorCode.PERMISSION };
  const { data, error } = await ctx.supabase
    .from("incident_duplicate_link")
    .update({ status: "revoked", revoked_by: ctx.accountId, revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("status", "active")
    .select("duplicate_incident_id, primary_incident_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: ErrorCode.STATE };
  revalidatePath(`/incidents/${data.duplicate_incident_id as string}`);
  revalidatePath(`/incidents/${data.primary_incident_id as string}`);
  return { ok: true };
}

export async function updateIncident(id: string, input: IncidentInput): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  // Editar clasificacion/impacto/prioridad de un caso es gestion (Gerencia), no del Operador.
  if (!(await anyPerm(["incident.assign", "triage.manage"]))) return { ok: false, error: ErrorCode.PERMISSION };
  const err = validateInput(input);
  if (err) return { ok: false, error: err };

  const priority = derivePriority(input.impact, input.urgency);
  const { error } = await ctx.supabase
    .from("incident")
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      category_id: input.categoryId,
      affected_ci_id: orNull(input.affectedCiId),
      affected_service_id: orNull(input.affectedServiceId),
      affected_product_id: orNull(input.affectedProductId),
      affected_channel_id: orNull(input.affectedChannelId),
      affected_business_unit_id: orNull(input.affectedBusinessUnitId),
      impact: input.impact,
      urgency: input.urgency,
      priority,
      financial_impact_estimate: input.financialImpactEstimate ?? 0,
      ...fintechCols(input),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  // Regenera el embedding si cambio el texto (idempotente por content_hash en la Edge Function).
  void triggerIncidentEmbedding(ctx.supabase, id);
  revalidatePath(`/incidents/${id}`);
  revalidatePath("/incidents");
  return { ok: true, id };
}

/** Resuelve un caso EXIGIENDO el reporte de solucion del operador (#11). El resumen alimenta el
 *  KB via capture_incident_closure_kb (seccion Solucion). Evidencia: se adjunta con uploadAttachment
 *  (bucket case-attachments) por separado desde la UI. Backend-authoritative. */
export async function resolveIncident(incidentId: string, resolutionSummary: string, rootCause?: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await anyPerm(["incident.update", "incident.resolve", "triage.manage"]))) return { ok: false, error: ErrorCode.PERMISSION };
  const own = await assertActOnIncident(ctx, incidentId);
  if (own) return { ok: false, error: own };
  const summary = (resolutionSummary ?? "").trim();
  if (summary.length < 15) return { ok: false, error: "RESOLUTION_REPORT_REQUIRED" };

  const patch: Record<string, unknown> = { status: "resolved", resolved_at: new Date().toISOString(), resolution_summary: summary };
  const rc = (rootCause ?? "").trim();
  if (rc) patch.root_cause_summary = rc;
  const { error } = await ctx.supabase.from("incident").update(patch).eq("id", incidentId).select("id").single();
  if (error) return { ok: false, error: error.message };
  // Knowledge al cierre: ahora con SOLUCION real documentada (no placeholder).
  await ctx.supabase.rpc("capture_incident_closure_kb", { p_id: incidentId });
  void triggerIncidentEmbedding(ctx.supabase, incidentId);
  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/incidents");
  return { ok: true, id: incidentId };
}

/** Eliminacion logica (soft delete) — nunca fisica (referenciado por el ledger). */
export async function softDeleteIncident(id: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  // Cancelar un caso es gestion (Gerencia), no del Operador.
  if (!(await anyPerm(["incident.assign", "triage.manage"]))) return { ok: false, error: ErrorCode.PERMISSION };
  const { error } = await ctx.supabase.from("incident").update({ status: "cancelled" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/incidents");
  return { ok: true, id };
}

export async function addComment(
  incidentId: string,
  body: string,
  visibility: "internal" | "partner",
): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  // Comentario de agente (incluye visibilidad interna): solo staff que trabaja casos. El usuario
  // final comenta por la RPC owner-checked add_my_case_comment, no por aqui.
  if (!(await anyPerm(["incident.update", "incident.resolve", "triage.manage", "incident.assign"]))) return { ok: false, error: ErrorCode.PERMISSION };
  // Regla de oro: comentar solo en casos PROPIOS (o gestor). Backend-authoritative.
  const own = await assertActOnIncident(ctx, incidentId);
  if (own) return { ok: false, error: own };
  const err = required(body);
  if (err) return { ok: false, error: err };
  const { error } = await ctx.supabase.from("incident_comment").insert({
    tenant_id: ctx.tenantId,
    incident_id: incidentId,
    author_user_id: ctx.accountId,
    body: body.trim(),
    visibility,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true };
}

export async function changeStatus(incidentId: string, status: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await anyPerm(["incident.update", "incident.resolve", "triage.manage"]))) return { ok: false, error: ErrorCode.PERMISSION };
  // Regla de oro: cambiar estado solo en casos PROPIOS (o gestor). Backend-authoritative.
  const own = await assertActOnIncident(ctx, incidentId);
  if (own) return { ok: false, error: own };
  // A1 (validacion de negocio, tambien en backend): no se puede pasar a "Asignado" sin al menos un
  // responsable. assigned_member_id es el responsable principal (espejo). Regla pura compartida.
  if (requiresAssignee(status)) {
    const { data: cur } = await ctx.supabase.from("incident").select("assigned_member_id").eq("id", incidentId).maybeSingle();
    const guard = assignmentGuard(status, !!cur?.assigned_member_id);
    if (guard) return { ok: false, error: guard };
  }
  const patch: Record<string, unknown> = { status };
  if (status === "resolved") {
    // #11: no se resuelve sin reporte de solucion documentado (alimenta el KB). Si no existe ya en
    // el caso, se exige usar el flujo de resolucion (resolveIncident) que lo captura.
    const { data: cur } = await ctx.supabase.from("incident").select("resolution_summary").eq("id", incidentId).maybeSingle();
    if (!cur?.resolution_summary || (cur.resolution_summary as string).trim().length < 15) return { ok: false, error: "RESOLUTION_REPORT_REQUIRED" };
    patch.resolved_at = new Date().toISOString();
  }
  const { error } = await ctx.supabase.from("incident").update(patch).eq("id", incidentId).select("id").single();
  if (error) return { ok: false, error: error.message };
  // Knowledge al RESOLVER/CERRAR: captura el caso como articulo draft (sintoma + SOLUCION: causa raiz
  // + resumen de resolucion) para reuso ante casos similares. Funcion SQL unica, idempotente y
  // SECURITY DEFINER, compartida con el cierre por evaluacion (submit_case_csat) para que NINGUN
  // camino de cierre quede sin capturar (§2.2).
  if (status === "resolved" || status === "closed") {
    await ctx.supabase.rpc("capture_incident_closure_kb", { p_id: incidentId });
  }
  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/incidents");
  return { ok: true };
}

/** Enviar a Evolucion: deja de gestionarse como incidencia, pero la mesa mantiene
 *  el tracking y la comunicacion (client-centric). No se cierra. */
export async function sendToEvolution(incidentId: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  // Gobierno de la derivacion: derivar a Evolucion es decision de la GERENCIA de Operaciones
  // (asignar/triar), no del Operador (que solo puede "Sugerir a la Gerencia"). No Evolucion.
  if (!(await anyPerm(["incident.assign", "triage.manage"]))) return { ok: false, error: ErrorCode.PERMISSION };
  const { data: inc, error } = await ctx.supabase
    .from("incident")
    .update({
      status: "in_evolution",
      transformation_candidate: true,
      transformation_decision: "to_evolution",
    })
    .eq("id", incidentId)
    .select("incident_number")
    .single();
  if (error) return { ok: false, error: error.message };
  await ctx.supabase.from("incident_comment").insert({
    tenant_id: ctx.tenantId,
    incident_id: incidentId,
    author_user_id: ctx.accountId,
    body: "Enviado al squad de Evolucion. La mesa de ayuda mantiene el tracking y la comunicacion con el cliente.",
    visibility: "partner",
    is_system_generated: true,
  });
  // Campanita (v1): avisa al Gerente de Evolucion que hay un caso derivado a atender.
  await ctx.supabase.rpc("notify_role", {
    p_role_code: "product_owner",
    p_type: "case_to_evolution",
    p_title: "Caso derivado a Evolucion",
    p_body: `El caso ${inc?.incident_number ?? ""} paso a Evolucion y espera valoracion.`,
    p_entity_type: "incident",
    p_entity_id: incidentId,
    p_link: "/analytics/comportamiento",
    p_severity: "info",
  });
  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/incidents");
  return { ok: true };
}
