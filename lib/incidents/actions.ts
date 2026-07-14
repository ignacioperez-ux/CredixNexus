"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { ErrorCode, required, minLength, firstError } from "@/lib/validation";
import { derivePriority, type Impact, type Urgency } from "@/lib/incidents/priority";

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
  if (!(await hasPermission(ctx.supabase, "incident.update"))) return { ok: false, error: ErrorCode.PERMISSION };
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
      ...fintechCols(input),
    })
    .select("id, incident_number")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/incidents");
  return { ok: true, id: data.id as string, number: data.incident_number as string };
}

export async function updateIncident(id: string, input: IncidentInput): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await anyPerm(["incident.update", "incident.resolve", "triage.manage"]))) return { ok: false, error: ErrorCode.PERMISSION };
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
  revalidatePath(`/incidents/${id}`);
  revalidatePath("/incidents");
  return { ok: true, id };
}

/** Eliminacion logica (soft delete) — nunca fisica (referenciado por el ledger). */
export async function softDeleteIncident(id: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await anyPerm(["incident.update", "incident.resolve", "triage.manage"]))) return { ok: false, error: ErrorCode.PERMISSION };
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
  const patch: Record<string, unknown> = { status };
  if (status === "resolved") patch.resolved_at = new Date().toISOString();
  const { error } = await ctx.supabase.from("incident").update(patch).eq("id", incidentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/incidents");
  return { ok: true };
}

/** Enviar a Evolucion: deja de gestionarse como incidencia, pero la mesa mantiene
 *  el tracking y la comunicacion (client-centric). No se cierra. */
export async function sendToEvolution(incidentId: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await anyPerm(["incident.update", "problem.manage", "project.manage"]))) return { ok: false, error: ErrorCode.PERMISSION };
  const { error } = await ctx.supabase
    .from("incident")
    .update({
      status: "in_evolution",
      transformation_candidate: true,
      transformation_decision: "to_evolution",
    })
    .eq("id", incidentId);
  if (error) return { ok: false, error: error.message };
  await ctx.supabase.from("incident_comment").insert({
    tenant_id: ctx.tenantId,
    incident_id: incidentId,
    author_user_id: ctx.accountId,
    body: "Enviado al squad de Evolucion. La mesa de ayuda mantiene el tracking y la comunicacion con el cliente.",
    visibility: "partner",
    is_system_generated: true,
  });
  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/incidents");
  return { ok: true };
}
