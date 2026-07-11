import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getDefinition, getDefinitionGraph, getWorkflowFormOptions } from "@/lib/workflows/queries";
import { DefinitionDetail } from "@/components/workflows/definition-detail";

export default async function DefinitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;

  const def = await getDefinition(ctx.supabase, id);
  if (!def) notFound();

  const [graph, options, canManage] = await Promise.all([
    getDefinitionGraph(ctx.supabase, id),
    getWorkflowFormOptions(ctx.supabase),
    hasPermission(ctx.supabase, "workflow.manage"),
  ]);

  return <DefinitionDetail def={def as never} nodes={graph.nodes} edges={graph.edges} options={options} canManage={canManage} />;
}
