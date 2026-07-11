import { getContext, hasPermission } from "@/lib/auth/context";
import { listCatalogItems, listRequests } from "@/lib/catalog/queries";
import { ServiceCatalog } from "@/components/catalog/service-catalog";

export default async function ServiceCatalogPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [items, requests, canRequest] = await Promise.all([
    listCatalogItems(ctx.supabase),
    listRequests(ctx.supabase),
    hasPermission(ctx.supabase, "service_catalog.request"),
  ]);
  return <ServiceCatalog items={items} requests={requests.rows} stats={requests.stats} canRequest={canRequest} />;
}
