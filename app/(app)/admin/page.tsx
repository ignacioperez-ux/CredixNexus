import { getContext } from "@/lib/auth/context";
import { getAdminOverview, listAdminUsers, listAdminRoles } from "@/lib/admin/queries";
import { AdminHub } from "@/components/admin/admin-hub";

export default async function AdminPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [overview, users, roles] = await Promise.all([
    getAdminOverview(ctx.supabase),
    listAdminUsers(ctx.supabase),
    listAdminRoles(ctx.supabase),
  ]);
  return <AdminHub overview={overview} users={users} roles={roles} selfAccountId={ctx.accountId} />;
}
