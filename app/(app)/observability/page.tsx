import { getContext, hasPermission } from "@/lib/auth/context";
import { listAlerts, listDxEvents } from "@/lib/observability/queries";
import { Observability } from "@/components/observability/observability";

export default async function ObservabilityPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [alerts, dx, canManage] = await Promise.all([
    listAlerts(ctx.supabase),
    listDxEvents(ctx.supabase),
    hasPermission(ctx.supabase, "observability.manage"),
  ]);
  return <Observability alerts={alerts} dx={dx} canManage={canManage} />;
}
