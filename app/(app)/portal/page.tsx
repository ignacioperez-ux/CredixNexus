import { getContext, hasPermission } from "@/lib/auth/context";
import { listPortalCategories, getMyReportedCases, listApplications } from "@/lib/portal/queries";
import { Portal } from "@/components/portal/portal";

export default async function PortalPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [categories, applications, canFeedback, canViewIncidents, myCases] = await Promise.all([
    listPortalCategories(ctx.supabase),
    listApplications(ctx.supabase),
    hasPermission(ctx.supabase, "knowledge.feedback"),
    hasPermission(ctx.supabase, "incident.read"),
    getMyReportedCases(ctx.supabase, ctx.accountId),
  ]);
  return <Portal categories={categories} applications={applications} canFeedback={canFeedback} canViewIncidents={canViewIncidents} myCases={myCases} />;
}
