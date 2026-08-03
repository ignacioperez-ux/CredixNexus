import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { listCatalogItems, listRequests, listServiceCategories } from "@/lib/catalog/queries";
import { getAtRiskIncidents, listEscalationEvents, listEscalationRules, listOlaPolicies, getSlaFormOptions } from "@/lib/sla/queries";
import { isRouteDeniedForRoles } from "@/lib/nav/access";
import { ServiceManagement } from "@/components/service/service-management";

// Fusion "Catalogo y SLA" (Fase B): la pantalla monta Catalogo de servicios y, para quien tiene
// sla.read, agrega la pestana "Gobierno SLA" (reusa Governance). Sin sla.read (p.ej. solicitante)
// se ve solo el catalogo, sin cambio. /sla-governance sigue existiendo para otros roles.
export default async function ServiceCatalogPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const access = await getAccessControl();
  const canRequest = access.isAdmin || access.perms.includes("service_catalog.request");
  const canManage = access.isAdmin || access.perms.includes("service_catalog.manage");
  // La pestana SLA replica el control de acceso de /sla-governance: perm sla.read Y que la persona
  // no lo tenga vedado por denylist (p.ej. el operador tiene sla.read pero /sla-governance le esta
  // vedado -> no debe ver Gobierno SLA embebido en el catalogo).
  const canSla = (access.isAdmin || access.perms.includes("sla.read")) && !isRouteDeniedForRoles("/sla-governance", access.roles);
  const canManageSla = access.isAdmin || access.perms.includes("sla.manage");
  // Solicitante sin gestion: solo sus solicitudes (P3). Gestor: todas + maestro de categorias.
  const [items, requests, allItems, categories, sla] = await Promise.all([
    listCatalogItems(ctx.supabase),
    listRequests(ctx.supabase, { ownerId: ctx.accountId, ownOnly: !canManage }),
    canManage ? listCatalogItems(ctx.supabase, true) : Promise.resolve([]),
    canManage ? listServiceCategories(ctx.supabase, true) : Promise.resolve([]),
    canSla
      ? Promise.all([
          getAtRiskIncidents(ctx.supabase), listEscalationEvents(ctx.supabase), listEscalationRules(ctx.supabase),
          listOlaPolicies(ctx.supabase), getSlaFormOptions(ctx.supabase),
        ]).then(([risk, events, rules, ola, options]) => ({ risk, events, rules, ola, options, canManage: canManageSla }))
      : Promise.resolve(null),
  ]);
  return (
    <ServiceManagement
      catalog={{ items, requests: requests.rows, stats: requests.stats, canRequest, canManage, allItems, categories }}
      sla={sla}
    />
  );
}
