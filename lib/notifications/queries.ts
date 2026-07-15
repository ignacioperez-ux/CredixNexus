import type { SupabaseClient } from "@supabase/supabase-js";

// Campanita v1. La RLS ya limita a las notificaciones del usuario (recipient + tenant),
// asi que las consultas no necesitan filtro extra.
export type NotificationItem = {
  id: string; type: string; title: string; body: string | null; link: string | null;
  severity: string; is_read: boolean; created_at: string; entity_type: string | null; entity_id: string | null;
};
export type NotificationsData = { items: NotificationItem[]; unread: number };

export async function listNotifications(supabase: SupabaseClient, limit = 20): Promise<NotificationsData> {
  const { data } = await supabase
    .from("notification")
    .select("id, type, title, body, link, severity, is_read, created_at, entity_type, entity_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  const items = (data ?? []) as NotificationItem[];
  const { count } = await supabase
    .from("notification")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  return { items, unread: count ?? items.filter((i) => !i.is_read).length };
}
