import { getContext } from "@/lib/auth/context";
import { getOperationsTower, getOpsInbox } from "@/lib/operations/queries";
import { getSupervisor, getOverview, getPerformance, getCategoryTrends, getRecurrenceAnalytics, getBehaviorAnalysis, normalizeDimension } from "@/lib/analytics/queries";
import { type DashboardCounts } from "@/components/dashboard/kpi-grid";
import { OperationsTower, type TowerAnalytics } from "@/components/operations/operations-tower";

// Torre de Control del Gerente de Operaciones (support_lead). UNIFICA la Torre + las metricas del
// ex-dashboard ejecutivo + la Analitica (Fase B): 3 pestanas (Resumen / Operacion / Analitica). La
// pestana Analitica embebe Analytics + Analisis de comportamiento; dim/weeks viajan en la URL. Todo
// dato real bajo RLS; resiliencia: si la analitica falla (rol sin analytics.read), se degrada sin
// tumbar la Torre. Guard (incident.read) + denylist de persona aplican en app/(app)/layout.tsx.
export default async function OperacionesPage({ searchParams }: { searchParams: Promise<{ dim?: string; weeks?: string }> }) {
  const ctx = await getContext();
  if (!ctx) return null;
  const sp = await searchParams;
  const dimension = normalizeDimension(sp.dim);
  const weeks = Math.min(52, Math.max(4, Number.parseInt(sp.weeks ?? "12", 10) || 12));

  const [tower, inbox, supervisor, overview, countsRes] = await Promise.all([
    getOperationsTower(ctx.supabase),
    getOpsInbox(ctx.supabase),
    getSupervisor(ctx.supabase),
    getOverview(ctx.supabase),
    ctx.supabase.rpc("dashboard_counts"),
  ]);
  const c = (countsRes.data ?? {}) as Partial<DashboardCounts>;
  const counts: DashboardCounts = {
    cmdb: c.cmdb ?? 0, integrations: c.integrations ?? 0, processes: c.processes ?? 0, products: c.products ?? 0, ledger: c.ledger ?? 0,
  };
  const firstName = ctx.name.trim().split(/\s+/)[0] || ctx.name;

  // Bundle de la pestana Analitica (reusa overview/supervisor ya leidos). Resiliente: gatea por
  // analytics.read en los RPC; si falla, analytics=null -> la Torre muestra el estado no-disponible.
  let analytics: TowerAnalytics | null = null;
  try {
    const [performance, categoryTrends, recurrence, behavior] = await Promise.all([
      getPerformance(ctx.supabase),
      getCategoryTrends(ctx.supabase),
      getRecurrenceAnalytics(ctx.supabase),
      getBehaviorAnalysis(ctx.supabase, dimension, weeks),
    ]);
    analytics = { performance, categoryTrends, recurrence, behavior, dimension, weeks };
  } catch {
    analytics = null;
  }

  return <OperationsTower tower={tower} inbox={inbox} supervisor={supervisor} overview={overview} counts={counts} firstName={firstName} analytics={analytics} />;
}
