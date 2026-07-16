import { getContext } from "@/lib/auth/context";
import { getMyPerformance } from "@/lib/operador/queries";
import { OpPerformanceView } from "@/components/operador/mi-desempeno";

export default async function MiDesempenoPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const firstName = ctx.name.trim().split(/\s+/)[0] || ctx.name;
  const perf = await getMyPerformance(ctx.supabase, ctx.accountId, firstName);
  return <OpPerformanceView perf={perf} />;
}
