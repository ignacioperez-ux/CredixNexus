import { getContext, hasPermission } from "@/lib/auth/context";
import { listInstances, listDefinitions } from "@/lib/workflows/queries";
import { Workflows } from "@/components/workflows/workflows";

export default async function WorkflowsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [instances, definitions, canManage] = await Promise.all([
    listInstances(ctx.supabase),
    listDefinitions(ctx.supabase),
    hasPermission(ctx.supabase, "workflow.manage"),
  ]);
  return <Workflows instances={instances} definitions={definitions} canManage={canManage} />;
}
