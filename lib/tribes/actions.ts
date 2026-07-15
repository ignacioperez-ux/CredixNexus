"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { validateTribe, isSquadType, type TribeInput } from "./validation";

export type TribeResult = { ok: boolean; error?: string; id?: string };

const PERM = "squad.manage"; // la estructura organizativa (tribus/squads) se gobierna con squad.manage
async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

/** Duplicado de codigo (§10.4 servicio): mismo code (case-insensitive) no borrado en el tenant. */
async function codeTaken(ctx: NonNullable<Awaited<ReturnType<typeof guard>>["ctx"]>, code: string, exceptId?: string): Promise<boolean> {
  let q = ctx.supabase.from("tribe").select("id").eq("tenant_id", ctx.tenantId).ilike("code", code.trim()).neq("status", "deleted");
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q.limit(1);
  return (data?.length ?? 0) > 0;
}

function cols(i: TribeInput) {
  return {
    code: i.code.trim(),
    name: i.name.trim(),
    mission: i.mission?.trim() || null,
    value_stream: i.valueStream?.trim() || null,
    objective: i.objective?.trim() || null,
    tribe_lead_user_id: i.tribeLeadUserId || null,
  };
}

export async function createTribe(input: TribeInput): Promise<TribeResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateTribe(input);
  if (v) return { ok: false, error: v };
  if (await codeTaken(ctx, input.code)) return { ok: false, error: ErrorCode.DUPLICATE };
  const { data, error } = await ctx.supabase.from("tribe").insert({
    tenant_id: ctx.tenantId, ...cols(input), created_by: ctx.accountId, updated_by: ctx.accountId,
  }).select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath("/evolucion/mapa");
  return { ok: true, id: data.id as string };
}

export async function updateTribe(id: string, input: TribeInput): Promise<TribeResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateTribe(input);
  if (v) return { ok: false, error: v };
  if (await codeTaken(ctx, input.code, id)) return { ok: false, error: ErrorCode.DUPLICATE };
  const { error } = await ctx.supabase.from("tribe").update({ ...cols(input), updated_by: ctx.accountId, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath("/evolucion/mapa");
  return { ok: true, id };
}

/** Baja/reactivacion logica (soft delete: la tribu puede tener squads referenciados). */
export async function setTribeStatus(id: string, status: "active" | "inactive"): Promise<TribeResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("tribe").update({ status, updated_by: ctx.accountId, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/evolucion/mapa");
  return { ok: true, id };
}

/** Asigna un squad a una tribu (o la quita) y opcionalmente fija su tipo. Fijar el tipo a mano
 *  BLOQUEA la reclasificacion automatica (type_locked=true): el override lo respeta el trigger. */
export async function assignSquadToTribe(squadId: string, tribeId: string | null, squadType?: string): Promise<TribeResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const patch: Record<string, unknown> = { tribe_id: tribeId, updated_by: ctx.accountId, updated_at: new Date().toISOString() };
  if (squadType) {
    if (!isSquadType(squadType)) return { ok: false, error: ErrorCode.FORMAT };
    patch.squad_type = squadType;
    patch.type_locked = true; // eleccion manual: el trigger la respeta
    if (squadType === "domain") patch.is_transversal = false;
    else if (squadType === "enabler") patch.is_transversal = true;
    // transient: no altera is_transversal
  }
  const { error } = await ctx.supabase.from("squad").update(patch).eq("id", squadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/evolucion/mapa");
  revalidatePath(`/squads/${squadId}`);
  return { ok: true, id: squadId };
}

/** Fija o libera el override manual del tipo. Al liberar, el trigger vuelve a decidir por membresia. */
export async function setSquadTypeLock(squadId: string, locked: boolean): Promise<TribeResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("squad").update({ type_locked: locked, updated_by: ctx.accountId, updated_at: new Date().toISOString() }).eq("id", squadId);
  if (error) return { ok: false, error: error.message };
  // Al liberar, reevaluar de una vez segun la membresia actual (el trigger solo corre en cambios de miembro).
  if (!locked) {
    const { count } = await ctx.supabase.from("squad_member").select("id", { count: "exact", head: true }).eq("squad_id", squadId).eq("status", "active");
    const has = (count ?? 0) > 0;
    await ctx.supabase.from("squad").update({ squad_type: has ? "domain" : "enabler", is_transversal: !has, updated_by: ctx.accountId }).eq("id", squadId).neq("squad_type", "transient");
  }
  revalidatePath("/evolucion/mapa");
  revalidatePath(`/squads/${squadId}`);
  return { ok: true, id: squadId };
}
