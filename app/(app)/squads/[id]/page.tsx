import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getSquad, getSquadRoster, getAssignableMembers, getSquadLeads, getSquadInitiatives } from "@/lib/squads/queries";
import { getSquadCapacities } from "@/lib/capacity/queries";
import { SquadDetail } from "@/components/squads/squad-detail";

export default async function SquadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;

  const squad = await getSquad(ctx.supabase, id);
  if (!squad) notFound();

  const [roster, assignable, canManage, leads, initiatives, caps, allocRes] = await Promise.all([
    getSquadRoster(ctx.supabase, id),
    getAssignableMembers(ctx.supabase, id),
    hasPermission(ctx.supabase, "squad.manage"),
    getSquadLeads(ctx.supabase, squad as Record<string, unknown>),
    getSquadInitiatives(ctx.supabase, id),
    getSquadCapacities(ctx.supabase),
    ctx.supabase.from("squad_member").select("member_id, allocation_pct").eq("status", "active"),
  ]);
  const cap = caps.find((c) => c.id === id) ?? null;

  // Sobreasignacion: personas cuya asignacion TOTAL entre squads supera 100% (dato existente).
  const totalByMember = new Map<string, number>();
  for (const m of ((allocRes.data ?? []) as { member_id: string; allocation_pct: number }[])) {
    totalByMember.set(m.member_id, (totalByMember.get(m.member_id) ?? 0) + (m.allocation_pct ?? 0));
  }
  const overAllocated = Array.from(totalByMember.entries()).filter(([, v]) => v > 100).map(([k]) => k);

  return <SquadDetail squad={squad as never} roster={roster} assignable={assignable} canManage={canManage} leads={leads} initiatives={initiatives} capacity={cap} overAllocated={overAllocated} />;
}
