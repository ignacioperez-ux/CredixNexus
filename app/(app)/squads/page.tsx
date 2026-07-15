import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getBusinessUnitOptions } from "@/lib/squads/queries";
import { getSquadCards } from "@/lib/capacity/queries";
import { SquadList } from "@/components/squads/squad-list";

export default async function SquadsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [cards, businessUnits, access] = await Promise.all([
    getSquadCards(ctx.supabase),
    getBusinessUnitOptions(ctx.supabase),
    getAccessControl(),
  ]);
  const canManage = access.isAdmin || access.perms.includes("squad.manage");
  return <SquadList cards={cards} businessUnits={businessUnits} canManage={canManage} />;
}
