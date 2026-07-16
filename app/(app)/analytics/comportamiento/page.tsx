import { getContext } from "@/lib/auth/context";
import { getBehaviorAnalysis, normalizeDimension, type BehaviorAnalysis } from "@/lib/analytics/queries";
import { BehaviorAnalysisView } from "@/components/analytics/behavior-analysis";
import { AnalyticsUnavailable } from "@/components/analytics/analytics-unavailable";

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
  // Resiliencia: el RPC gatea por analytics.read; si el rol no lo tiene o el RPC falla, se degrada
  // en vez de tumbar la pantalla (ningun rol vuelve a ser "expulsado" por un agregado gateado).
  let data: BehaviorAnalysis;
  try {
    data = await getBehaviorAnalysis(ctx.supabase, dimension, weeks);
  } catch {
    return <AnalyticsUnavailable />;
  }

  return <BehaviorAnalysisView data={data} dimension={dimension} weeks={weeks} />;
}
