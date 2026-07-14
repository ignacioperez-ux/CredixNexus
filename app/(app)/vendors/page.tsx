import { getContext, hasPermission } from "@/lib/auth/context";
import { listVendors, getVendorScorecard } from "@/lib/vendors/queries";
import { VendorList } from "@/components/vendors/vendor-list";

export default async function VendorsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [data, scorecard, canManage] = await Promise.all([
    listVendors(ctx.supabase),
    getVendorScorecard(ctx.supabase),
    hasPermission(ctx.supabase, "vendor.manage"),
  ]);
  return <VendorList data={data} scorecard={scorecard} canManage={canManage} />;
}
