import { getContext } from "@/lib/auth/context";
import { listNotifications } from "@/lib/notifications/queries";
import { OpNotificationsView } from "@/components/operador/notificaciones";

export default async function NotificacionesPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const data = await listNotifications(ctx.supabase, 50);
  return <OpNotificationsView data={data} />;
}
