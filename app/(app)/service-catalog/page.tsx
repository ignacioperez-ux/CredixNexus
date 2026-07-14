import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { listCatalogItems, listRequests, listServiceCategories } from "@/lib/catalog/queries";
import { ServiceCatalog } from "@/components/catalog/service-catalog";

export default async function ServiceCatalogPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const access = await getAccessControl();
  const canRequest = access.isAdmin || access.perms.includes("service_catalog.request");
  const canManage = access.isAdmin || access.perms.includes("service_catalog.manage");
  // Solicitante sin gestion: solo sus solicitudes (P3). Gestor: todas + maestro de categorias.
  const [items, requests, allItems, categories] = await Promise.all([
    listCatalogItems(ctx.supabase),
    listRequests(ctx.supabase, { ownerId: ctx.accountId, ownOnly: !canManage }),
    canManage ? listCatalogItems(ctx.supabase, true) : Promise.resolve([]),
    canManage ? listServiceCategories(ctx.supabase, true) : Promise.resolve([]),
  ]);
  return <ServiceCatalog items={items} requests={requests.rows} stats={requests.stats} canRequest={canRequest} canManage={canManage} allItems={allItems} categories={categories} />;
}
