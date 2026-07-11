"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import {
  validateAcknowledge,
  validateResolve,
  validateCorrelate,
  validateCreateCase,
} from "@/lib/observability/validation";

export type AlertResult = { ok: boolean; error?: string; id?: string; incidentId?: string };

const PERM = "observability.manage";

async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

async function loadAlert(ctx: NonNullable<Awaited<ReturnType<typeof getContext>>>, id: string) {
  const { data } = await ctx.supabase
    .from("monitoring_alert")
    .select("id, status, severity, title, description, affected_system, affected_api, affected_service_id, affected_ci_id, affected_product_id, correlated_case_id")
    .eq("id", id)
    .maybeSingle();
  return data as {
    id: string; status: string; severity: string; title: string; description: string | null;
    affected_system: string | null; affected_api: string | null;
    affected_service_id: string | null; affected_ci_id: string | null; affected_product_id: string | null;
    correlated_case_id: string | null;
  } | null;
}

function refresh() {
  revalidatePath("/observability");
}

/** Reconocer una alerta abierta (asumir su gestion). */
export async function acknowledgeAlert(id: string): Promise<AlertResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const alert = await loadAlert(ctx, id);
  if (!alert) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const v = validateAcknowledge(alert.status);
  if (v) return { ok: false, error: v };
  const { error } = await ctx.supabase
    .from("monitoring_alert")
    .update({ status: "acknowledged", acknowledged_by: ctx.accountId, acknowledged_at: new Date().toISOString(), updated_by: ctx.accountId })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, id };
}

/** Resolver una alerta (senal atendida). */
export async function resolveAlert(id: string): Promise<AlertResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const alert = await loadAlert(ctx, id);
  if (!alert) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const v = validateResolve(alert.status);
  if (v) return { ok: false, error: v };
  const { error } = await ctx.supabase
    .from("monitoring_alert")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), updated_by: ctx.accountId })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, id };
}

/** Correlacionar la alerta con un caso (incidente) ya existente. */
export async function correlateAlert(id: string, incidentId: string): Promise<AlertResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const alert = await loadAlert(ctx, id);
  if (!alert) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const v = validateCorrelate(alert.status, incidentId);
  if (v) return { ok: false, error: v };
  // Verificar que el caso existe en el tenant (RLS acota).
  const { data: inc } = await ctx.supabase.from("incident").select("id").eq("id", incidentId).maybeSingle();
  if (!inc) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const { error } = await ctx.supabase
    .from("monitoring_alert")
    .update({ status: "correlated", correlated_case_id: incidentId, updated_by: ctx.accountId })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, id, incidentId };
}

/** Sensor -> accion: crear un caso (incidente) desde la alerta y correlacionarlo.
 *  Severidad -> impacto/urgencia -> prioridad (matriz ITIL). El caso entra por el
 *  area de Operaciones. La comunicacion/tracking queda anclada al caso. */
export async function createCaseFromAlert(id: string): Promise<AlertResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const alert = await loadAlert(ctx, id);
  if (!alert) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const v = validateCreateCase(alert.status);
  if (v) return { ok: false, error: v };

  // Atomico (§11): la funcion crea el incidente ancla y correlaciona la alerta en una sola
  // transaccion; el ledger y ambas filas se confirman o revierten juntos.
  const { data: incidentId, error } = await ctx.supabase.rpc("create_case_from_alert", { p_alert_id: id });
  if (error) {
    if (error.message.includes("invalid_state")) return { ok: false, error: ErrorCode.STATE };
    if (error.message.includes("alert_not_found")) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
    return { ok: false, error: error.message };
  }

  refresh();
  revalidatePath("/incidents");
  return { ok: true, id, incidentId: incidentId as string };
}
