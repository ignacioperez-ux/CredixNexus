import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getProcess, listSystems } from "@/lib/process/queries";
import { ProcessCard } from "@/components/process/process-card";

export default async function ProcessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  const [detail, canManage] = await Promise.all([
    getProcess(ctx.supabase, id),
    hasPermission(ctx.supabase, "process.manage"),
  ]);
  if (!detail) notFound();
  const systems = canManage ? await listSystems(ctx.supabase) : [];
  return <ProcessCard detail={detail} systems={systems} canManage={canManage} />;
}
