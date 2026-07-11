import { getContext } from "@/lib/auth/context";
import { getTalentProfiles } from "@/lib/talent/queries";
import { TalentList } from "@/components/talent/talent-list";

export default async function TalentPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const profiles = await getTalentProfiles(ctx.supabase);
  return <TalentList profiles={profiles} />;
}
