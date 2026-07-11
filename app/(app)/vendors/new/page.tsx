import { redirect } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { VendorForm } from "@/components/vendors/vendor-form";

export default async function NewVendorPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  if (!(await hasPermission(ctx.supabase, "vendor.manage"))) redirect("/vendors");
  return <VendorForm />;
}
