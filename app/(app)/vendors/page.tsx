import { getContext, hasPermission } from "@/lib/auth/context";
import { listVendors } from "@/lib/vendors/queries";
import { VendorList } from "@/components/vendors/vendor-list";

export default async function VendorsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [data, canManage] = await Promise.all([
    listVendors(ctx.supabase),
    hasPermission(ctx.supabase, "vendor.manage"),
  ]);
  return <VendorList data={data} canManage={canManage} />;
}
