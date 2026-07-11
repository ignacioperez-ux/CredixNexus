import { getContext } from "@/lib/auth/context";
import { listPendingCases } from "@/lib/triage/queries";
import { TriageQueue } from "@/components/triage/triage-queue";

export default async function TriagePage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const rows = await listPendingCases(ctx.supabase);
  return <TriageQueue rows={rows} />;
}
