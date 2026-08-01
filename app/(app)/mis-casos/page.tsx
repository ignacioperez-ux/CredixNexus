import { getContext } from "@/lib/auth/context";
import { getMyCases, getTeamQueue, getDuplicateCounts } from "@/lib/operador/queries";
import { getMyMemberId } from "@/lib/incidents/queries";
import { OpCasesView } from "@/components/operador/mis-casos";

export default async function MisCasosPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [cases, queue, memberId] = await Promise.all([
    getMyCases(ctx.supabase, ctx.accountId),
    getTeamQueue(ctx.supabase, ctx.accountId),
    getMyMemberId(ctx.supabase, ctx.accountId),
  ]);
  const ids = [...cases.map((c) => c.id), ...queue.unassigned.map((c) => c.id)];
  const dupCounts = await getDuplicateCounts(ctx.supabase, ids);
  return <OpCasesView cases={cases} unassigned={queue.unassigned} dupCounts={dupCounts} linked={!!memberId} />;
}
