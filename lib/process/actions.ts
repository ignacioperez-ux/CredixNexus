"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { validateProcessSystem, validateProductChannel, type ProcessSystemInput, type ProductChannelInput } from "@/lib/process/validation";

export type GovResult = { ok: boolean; error?: string; id?: string };

const PERM = "process.manage";

async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

// ---- Proceso -> sistema ----
export async function linkProcessSystem(input: ProcessSystemInput): Promise<GovResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateProcessSystem(input);
  if (v) return { ok: false, error: v };
  const { data, error } = await ctx.supabase
    .from("process_system")
    .insert({ tenant_id: ctx.tenantId, process_id: input.processId, ci_id: input.ciId, role: input.role, criticality: input.criticality, created_by: ctx.accountId })
    .select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath(`/processes/${input.processId}`);
  revalidatePath("/processes");
  return { ok: true, id: data.id as string };
}

export async function unlinkProcessSystem(id: string, processId: string): Promise<GovResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("process_system").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/processes/${processId}`);
  return { ok: true, id };
}

// ---- Producto -> canal ----
export async function linkProductChannel(input: ProductChannelInput): Promise<GovResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateProductChannel(input);
  if (v) return { ok: false, error: v };
  const { data, error } = await ctx.supabase
    .from("product_channel")
    .insert({ tenant_id: ctx.tenantId, product_id: input.productId, channel_id: input.channelId, availability: input.availability, created_by: ctx.accountId })
    .select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath("/processes");
  return { ok: true, id: data.id as string };
}

export async function unlinkProductChannel(id: string): Promise<GovResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("product_channel").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/processes");
  return { ok: true, id };
}
