import { getContext, hasPermission } from "@/lib/auth/context";
import { getDependencyGraph } from "@/lib/dependencies/queries";
import { DependencyGraphView } from "@/components/dependencies/dependency-graph";

export default async function DependenciesPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [graph, canManage] = await Promise.all([
    getDependencyGraph(ctx.supabase),
    hasPermission(ctx.supabase, "cmdb.manage"),
  ]);
  return <DependencyGraphView graph={graph} canManage={canManage} />;
}
