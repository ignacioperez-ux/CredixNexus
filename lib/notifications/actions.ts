"use server";

import { getContext } from "@/lib/auth/context";

export type NotifResult = { ok: boolean; error?: string };

/** Marca una notificacion como leida. La RLS asegura que solo puede ser la propia. */
export async function markNotificationRead(id: string): Promise<NotifResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "PERMISSION" };
  const { error } = await ctx.supabase
    .from("notification")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Marca todas las no leidas del usuario como leidas (RLS limita al propio recipient). */
export async function markAllNotificationsRead(): Promise<NotifResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "PERMISSION" };
  const { error } = await ctx.supabase
    .from("notification")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("is_read", false);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
