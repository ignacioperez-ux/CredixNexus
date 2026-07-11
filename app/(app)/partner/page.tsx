import { getContext } from "@/lib/auth/context";
import { getPartnerPortal } from "@/lib/partner/queries";
import { PartnerPortalView } from "@/components/partner/partner-portal";

export default async function PartnerPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const data = await getPartnerPortal(ctx.supabase, ctx.partyId);
  return <PartnerPortalView data={data} />;
}
