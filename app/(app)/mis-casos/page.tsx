import { getContext } from "@/lib/auth/context";
import { getMyCases } from "@/lib/operador/queries";
import { getMyMemberId } from "@/lib/incidents/queries";
import { OpCasesView } from "@/components/operador/mis-casos";

export default async function MisCasosPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [cases, memberId] = await Promise.all([getMyCases(ctx.supabase, ctx.accountId), getMyMemberId(ctx.supabase, ctx.accountId)]);
  return <OpCasesView cases={cases} linked={!!memberId} />;
}
