import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { listPortalCategories, getMyReportedCases, listApplications } from "@/lib/portal/queries";
import { Portal } from "@/components/portal/portal";

export default async function PortalPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [categories, applications, myCases, access] = await Promise.all([
    listPortalCategories(ctx.supabase),
    listApplications(ctx.supabase),
    getMyReportedCases(ctx.supabase, ctx.accountId),
    getAccessControl(),
  ]);
  const canFeedback = access.isAdmin || access.perms.includes("knowledge.feedback");
  const canViewIncidents = access.isAdmin || access.perms.includes("incident.read");
  return <Portal categories={categories} applications={applications} canFeedback={canFeedback} canViewIncidents={canViewIncidents} myCases={myCases} userName={ctx.name} />;
}
