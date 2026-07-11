import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { getCustomer360 } from "@/lib/customers/queries";
import { Customer360 } from "@/components/customers/customer-360";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  const data = await getCustomer360(ctx.supabase, id);
  if (!data.party) notFound();
  return <Customer360 data={data as never} />;
}
