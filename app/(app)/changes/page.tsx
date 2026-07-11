import { getContext, hasPermission } from "@/lib/auth/context";
import { listChanges } from "@/lib/changes/queries";
import { ChangeList } from "@/components/changes/change-list";

export default async function ChangesPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [data, canManage] = await Promise.all([
    listChanges(ctx.supabase),
    hasPermission(ctx.supabase, "change.manage"),
  ]);
  return <ChangeList data={data} canManage={canManage} />;
}
