import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getDisputeCase } from "@/lib/fraud/queries";
import { DisputeDetail, type DisputeDetailData } from "@/components/fraud/dispute-detail";

export default async function DisputeCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  const [dc, canManage] = await Promise.all([getDisputeCase(ctx.supabase, id), hasPermission(ctx.supabase, "dispute.manage")]);
  if (!dc) notFound();
  return <DisputeDetail dc={dc as unknown as DisputeDetailData} canManage={canManage} />;
}
