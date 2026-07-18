"use server";

import { getContext } from "@/lib/auth/context";
import { listNotifications, type NotificationsData } from "@/lib/notifications/queries";

export type NotifResult = { ok: boolean; error?: string };

/** Re-consulta las notificaciones del usuario (para refresco en vivo de la campanita sin
 *  recargar toda la pagina). La RLS limita al propio recipient + tenant. */
export async function fetchNotifications(): Promise<NotificationsData> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { items: [], unread: 0 };
  return listNotifications(ctx.supabase);
}

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
