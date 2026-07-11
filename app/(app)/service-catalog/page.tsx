import { getContext, hasPermission } from "@/lib/auth/context";
import { listCatalogItems, listRequests } from "@/lib/catalog/queries";
import { ServiceCatalog } from "@/components/catalog/service-catalog";

export default async function ServiceCatalogPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [items, requests, canRequest, canManage] = await Promise.all([
    listCatalogItems(ctx.supabase),
    listRequests(ctx.supabase),
    hasPermission(ctx.supabase, "service_catalog.request"),
    hasPermission(ctx.supabase, "service_catalog.manage"),
  ]);
  const allItems = canManage ? await listCatalogItems(ctx.supabase, true) : [];
  return <ServiceCatalog items={items} requests={requests.rows} stats={requests.stats} canRequest={canRequest} canManage={canManage} allItems={allItems} />;
}
