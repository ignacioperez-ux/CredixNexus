import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getTalentProfiles, getTalentAreas } from "@/lib/talent/queries";
import { TalentList } from "@/components/talent/talent-list";

export default async function TalentPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [profiles, areas, access] = await Promise.all([
    getTalentProfiles(ctx.supabase),
    getTalentAreas(ctx.supabase),
    getAccessControl(),
  ]);
  const canManage = access.isAdmin || access.perms.includes("talent.manage");
  return <TalentList profiles={profiles} areas={areas} canManage={canManage} />;
}
