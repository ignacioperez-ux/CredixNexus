import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { listPortalCategories, getMyReportedCases, listApplications, getMyActivity } from "@/lib/portal/queries";
import { getCaseTypeMeta } from "@/lib/incidents/queries";
import { Portal } from "@/components/portal/portal";

export default async function PortalPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [categories, applications, myCases, caseTypes, activity, access] = await Promise.all([
    listPortalCategories(ctx.supabase),
    listApplications(ctx.supabase),
    getMyReportedCases(ctx.supabase, ctx.accountId),
    getCaseTypeMeta(ctx.supabase),
    getMyActivity(ctx.supabase),
    getAccessControl(),
  ]);
  const canFeedback = access.isAdmin || access.perms.includes("knowledge.feedback");
  const canViewIncidents = access.isAdmin || access.perms.includes("incident.read");
  return <Portal categories={categories} applications={applications} canFeedback={canFeedback} canViewIncidents={canViewIncidents} myCases={myCases} caseTypes={caseTypes} activity={activity} userName={ctx.name} />;
}
