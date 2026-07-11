import { getContext } from "@/lib/auth/context";
import { listCustomers } from "@/lib/customers/queries";
import { CustomerList } from "@/components/customers/customer-list";

export default async function CustomersPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const rows = await listCustomers(ctx.supabase);
  return <CustomerList rows={rows} />;
}
