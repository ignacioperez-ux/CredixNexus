import { getContext, hasPermission } from "@/lib/auth/context";
import { listDeliveryAreas } from "@/lib/areas/queries";
import { AreaList } from "@/components/areas/area-list";

export default async function DeliveryAreasPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [rows, canManage] = await Promise.all([
    listDeliveryAreas(ctx.supabase),
    hasPermission(ctx.supabase, "area.manage"),
  ]);
  return <AreaList rows={rows} canManage={canManage} />;
}
