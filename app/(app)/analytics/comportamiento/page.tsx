import { getContext } from "@/lib/auth/context";
import { getBehaviorAnalysis, normalizeDimension } from "@/lib/analytics/queries";
import { BehaviorAnalysisView } from "@/components/analytics/behavior-analysis";

// Vista "Analisis de comportamiento" (Fase Evolucion 1.3): comportamiento AGREGADO de casos
// por dimension de negocio. Dimension y ventana viajan en la URL (?dim=&weeks=) -> re-fetch
// en servidor con dato real (nada mockeado en cliente). El RPC gatea por analytics.read.
export default async function BehaviorAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ dim?: string; weeks?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx) return null;

  const dimension = normalizeDimension(sp.dim);
  const weeks = Math.min(52, Math.max(4, Number.parseInt(sp.weeks ?? "12", 10) || 12));
  const data = await getBehaviorAnalysis(ctx.supabase, dimension, weeks);

  return <BehaviorAnalysisView data={data} dimension={dimension} weeks={weeks} />;
}
