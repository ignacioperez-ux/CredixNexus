import { getContext, hasPermission } from "@/lib/auth/context";
import { listPendingCases } from "@/lib/triage/queries";
import { TriageQueue } from "@/components/triage/triage-queue";

export default async function TriagePage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [rows, canManage] = await Promise.all([
    listPendingCases(ctx.supabase),
    hasPermission(ctx.supabase, "triage.manage"),
  ]);
  return <TriageQueue rows={rows} canManage={canManage} />;
}
