import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getTalentProfiles, getTalentOptions } from "@/lib/talent/queries";
import { TalentList } from "@/components/talent/talent-list";

export default async function TalentPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [profiles, options, access] = await Promise.all([
    getTalentProfiles(ctx.supabase),
    getTalentOptions(ctx.supabase),
    getAccessControl(),
  ]);
  const canManage = access.isAdmin || access.perms.includes("talent.manage");
  return <TalentList profiles={profiles} areas={options.areas} canManage={canManage} />;
}
