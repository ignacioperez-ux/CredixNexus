import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getSquad, getSquadRoster, getAssignableMembers, getSquadLeads, getSquadInitiatives } from "@/lib/squads/queries";
import { SquadDetail } from "@/components/squads/squad-detail";

export default async function SquadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;

  const squad = await getSquad(ctx.supabase, id);
  if (!squad) notFound();

  const [roster, assignable, canManage, leads, initiatives] = await Promise.all([
    getSquadRoster(ctx.supabase, id),
    getAssignableMembers(ctx.supabase, id),
    hasPermission(ctx.supabase, "squad.manage"),
    getSquadLeads(ctx.supabase, squad as Record<string, unknown>),
    getSquadInitiatives(ctx.supabase, id),
  ]);

  return <SquadDetail squad={squad as never} roster={roster} assignable={assignable} canManage={canManage} leads={leads} initiatives={initiatives} />;
}
