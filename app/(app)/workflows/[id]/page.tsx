import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getInstance, getInstanceSteps } from "@/lib/workflows/queries";
import { getLedgerForEntity } from "@/lib/incidents/queries";
import { InstanceDetail } from "@/components/workflows/instance-detail";

export default async function WorkflowInstancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;

  const instance = await getInstance(ctx.supabase, id);
  if (!instance) notFound();

  const [steps, ledger, canRun] = await Promise.all([
    getInstanceSteps(ctx.supabase, id),
    getLedgerForEntity(ctx.supabase, id),
    hasPermission(ctx.supabase, "workflow.run"),
  ]);

  return <InstanceDetail instance={instance as never} steps={steps} ledger={ledger as never} canRun={canRun} />;
}
