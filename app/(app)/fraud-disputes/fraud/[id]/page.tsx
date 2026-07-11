import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getFraudCase } from "@/lib/fraud/queries";
import { FraudDetail, type FraudDetailData } from "@/components/fraud/fraud-detail";

export default async function FraudCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  const [fc, canManage] = await Promise.all([getFraudCase(ctx.supabase, id), hasPermission(ctx.supabase, "fraud.manage")]);
  if (!fc) notFound();
  return <FraudDetail fc={fc as unknown as FraudDetailData} canManage={canManage} />;
}
