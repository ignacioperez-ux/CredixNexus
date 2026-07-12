"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";

export type AdminResult = { ok: boolean; error?: string };

const PERM = "user.manage";

async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

function mapErr(msg: string): string {
  if (msg.includes("self_forbidden")) return "ERR_SELF";
  if (msg.includes("forbidden")) return ErrorCode.PERMISSION;
  if (msg.includes("not_found")) return ErrorCode.INVALID_REFERENCE;
  return msg;
}

export async function setUserRoles(accountId: string, roles: string[]): Promise<AdminResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.rpc("admin_set_user_roles", { p_account: accountId, p_roles: roles });
  if (error) return { ok: false, error: mapErr(error.message) };
  revalidatePath("/admin");
  return { ok: true };
}

export async function setUserStatus(accountId: string, active: boolean): Promise<AdminResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.rpc("admin_set_user_status", { p_account: accountId, p_active: active });
  if (error) return { ok: false, error: mapErr(error.message) };
  revalidatePath("/admin");
  return { ok: true };
}
