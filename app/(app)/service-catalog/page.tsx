import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { listCatalogItems, listRequests } from "@/lib/catalog/queries";
import { ServiceCatalog } from "@/components/catalog/service-catalog";

export default async function ServiceCatalogPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [items, requests, access] = await Promise.all([
    listCatalogItems(ctx.supabase),
    listRequests(ctx.supabase),
    getAccessControl(),
  ]);
  const canRequest = access.isAdmin || access.perms.includes("service_catalog.request");
  const canManage = access.isAdmin || access.perms.includes("service_catalog.manage");
  const allItems = canManage ? await listCatalogItems(ctx.supabase, true) : [];
  return <ServiceCatalog items={items} requests={requests.rows} stats={requests.stats} canRequest={canRequest} canManage={canManage} allItems={allItems} />;
}
