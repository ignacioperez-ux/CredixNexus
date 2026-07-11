import { getContext, hasPermission } from "@/lib/auth/context";
import { listRiskEvents } from "@/lib/risk/queries";
import { RiskList } from "@/components/risk/risk-list";

export default async function RiskPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [data, canManage] = await Promise.all([
    listRiskEvents(ctx.supabase),
    hasPermission(ctx.supabase, "risk.manage"),
  ]);
  return <RiskList data={data} canManage={canManage} />;
}
