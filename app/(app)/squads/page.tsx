import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { listSquads, getBusinessUnitOptions } from "@/lib/squads/queries";
import { SquadList } from "@/components/squads/squad-list";

export default async function SquadsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [rows, businessUnits, access] = await Promise.all([
    listSquads(ctx.supabase),
    getBusinessUnitOptions(ctx.supabase),
    getAccessControl(),
  ]);
  const canManage = access.isAdmin || access.perms.includes("squad.manage");
  return <SquadList rows={rows} businessUnits={businessUnits} canManage={canManage} />;
}
