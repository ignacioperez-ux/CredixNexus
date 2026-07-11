import { getContext, hasPermission } from "@/lib/auth/context";
import { listPortalCategories } from "@/lib/portal/queries";
import { Portal } from "@/components/portal/portal";

export default async function PortalPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [categories, canFeedback] = await Promise.all([
    listPortalCategories(ctx.supabase),
    hasPermission(ctx.supabase, "knowledge.feedback"),
  ]);
  return <Portal categories={categories} canFeedback={canFeedback} />;
}
