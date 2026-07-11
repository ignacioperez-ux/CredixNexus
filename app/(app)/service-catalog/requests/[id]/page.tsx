import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getRequest } from "@/lib/catalog/queries";
import { RequestDetail, type RequestDetailData } from "@/components/catalog/request-detail";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  const [req, canManage] = await Promise.all([getRequest(ctx.supabase, id), hasPermission(ctx.supabase, "service_catalog.manage")]);
  if (!req) notFound();
  return <RequestDetail req={req as unknown as RequestDetailData} canManage={canManage} />;
}
