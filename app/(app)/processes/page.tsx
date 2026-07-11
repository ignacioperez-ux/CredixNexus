import { getContext, hasPermission } from "@/lib/auth/context";
import { listProcesses, getProductChannelMatrix } from "@/lib/process/queries";
import { ProcessGovernance } from "@/components/process/process-governance";

export default async function ProcessesPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [{ rows, stats }, matrix, canManage] = await Promise.all([
    listProcesses(ctx.supabase),
    getProductChannelMatrix(ctx.supabase),
    hasPermission(ctx.supabase, "process.manage"),
  ]);
  return <ProcessGovernance rows={rows} stats={stats} matrix={matrix} canManage={canManage} />;
}
