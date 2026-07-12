import { getContext, hasPermission } from "@/lib/auth/context";
import { listPortalCategories, getMyReportedCases } from "@/lib/portal/queries";
import { Portal } from "@/components/portal/portal";

export default async function PortalPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [categories, canFeedback, canViewIncidents, myCases] = await Promise.all([
    listPortalCategories(ctx.supabase),
    hasPermission(ctx.supabase, "knowledge.feedback"),
    hasPermission(ctx.supabase, "incident.read"),
    getMyReportedCases(ctx.supabase, ctx.accountId),
  ]);
  return <Portal categories={categories} canFeedback={canFeedback} canViewIncidents={canViewIncidents} myCases={myCases} />;
}
