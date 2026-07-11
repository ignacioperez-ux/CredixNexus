import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getVendor, getVendorSystems, getVendorIncidents } from "@/lib/vendors/queries";
import { VendorDetail } from "@/components/vendors/vendor-detail";

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;

  const vendor = await getVendor(ctx.supabase, id);
  if (!vendor) notFound();

  const [systems, incidents, canManage] = await Promise.all([
    getVendorSystems(ctx.supabase, id),
    getVendorIncidents(ctx.supabase, id),
    hasPermission(ctx.supabase, "vendor.manage"),
  ]);

  return <VendorDetail vendor={vendor as never} systems={systems} incidents={incidents} canManage={canManage} />;
}
