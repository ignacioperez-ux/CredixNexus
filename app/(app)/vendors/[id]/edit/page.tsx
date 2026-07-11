import { notFound, redirect } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getVendor } from "@/lib/vendors/queries";
import { VendorForm } from "@/components/vendors/vendor-form";

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  if (!(await hasPermission(ctx.supabase, "vendor.manage"))) redirect(`/vendors/${id}`);

  const vendor = await getVendor(ctx.supabase, id);
  if (!vendor) notFound();
  const v = vendor as Record<string, unknown>;

  return (
    <VendorForm initial={{
      id,
      code: (v.code as string) ?? "", name: (v.name as string) ?? "", legalName: (v.legal_name as string) ?? "",
      category: (v.category as string) ?? "saas", criticality: (v.criticality as string) ?? "medium",
      contactName: (v.contact_name as string) ?? "", contactEmail: (v.contact_email as string) ?? "", contactPhone: (v.contact_phone as string) ?? "",
      website: (v.website as string) ?? "", contractNumber: (v.contract_number as string) ?? "",
      contractStart: (v.contract_start as string) ?? "", contractEnd: (v.contract_end as string) ?? "",
      slaTerms: (v.sla_terms as string) ?? "", notes: (v.notes as string) ?? "",
    }} />
  );
}
