import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getRequest } from "@/lib/catalog/queries";
import { RequestDetail, type RequestDetailData } from "@/components/catalog/request-detail";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  const [req, canManage, canViewIncident] = await Promise.all([
    getRequest(ctx.supabase, id),
    hasPermission(ctx.supabase, "service_catalog.manage"),
    hasPermission(ctx.supabase, "incident.read"),
  ]);
  if (!req) notFound();
  // Seguridad (P3 / UX-003): sin gestion, solo el propietario abre su solicitud (evita IDOR
  // a nivel de tenant). Se refuerza con la RLS por propietario en service_request.
  const ownerId = (req as { requested_by_user_id?: string }).requested_by_user_id;
  if (!canManage && ownerId !== ctx.accountId) notFound();
  return <RequestDetail req={req as unknown as RequestDetailData} canManage={canManage} canViewIncident={canViewIncident} />;
}
