"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";

export type ViewResult = { ok: boolean; error?: string; id?: string };

// Guarda (o actualiza por nombre) la combinacion de filtros del usuario para un modulo.
export async function saveView(scope: string, name: string, filters: Record<string, unknown>): Promise<ViewResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId || !ctx.accountId) return { ok: false, error: ErrorCode.PERMISSION };
  const n = name.trim();
  if (!n) return { ok: false, error: ErrorCode.REQUIRED };
  const { data, error } = await ctx.supabase
    .from("saved_view")
    .upsert(
      { tenant_id: ctx.tenantId, user_id: ctx.accountId, scope, name: n.slice(0, 80), filters, updated_by: ctx.accountId },
      { onConflict: "tenant_id,user_id,scope,name" },
    )
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/incidents");
  return { ok: true, id: data.id as string };
}

// Elimina una vista propia (scope per-usuario en la capa app).
export async function deleteSavedView(id: string): Promise<ViewResult> {
  const ctx = await getContext();
  if (!ctx?.accountId) return { ok: false, error: ErrorCode.PERMISSION };
  const { error } = await ctx.supabase.from("saved_view").delete().eq("id", id).eq("user_id", ctx.accountId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/incidents");
  return { ok: true };
}
