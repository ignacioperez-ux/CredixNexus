import { getContext } from "@/lib/auth/context";
import { getOperationsTower } from "@/lib/operations/queries";
import { getSupervisor, getOverview } from "@/lib/analytics/queries";
import { type DashboardCounts } from "@/components/dashboard/kpi-grid";
import { OperationsTower } from "@/components/operations/operations-tower";

// Torre de Control del Gerente de Operaciones (support_lead). UNIFICA la Torre + las metricas del
// ex-dashboard ejecutivo: decision primero (hero + bandeja), luego operacion (KPIs) y detalle en tabs.
// Reutiliza las 4 lecturas existentes (getOperationsTower + getSupervisor + getOverview +
// dashboard_counts) sin duplicar logica; todo real y bajo RLS. Guard (incident.read) + denylist de
// persona ya aplican en app/(app)/layout.tsx.
export default async function OperacionesPage() {
  const ctx = await getContext();
  if (!ctx) return null;

  const [tower, supervisor, overview, countsRes] = await Promise.all([
    getOperationsTower(ctx.supabase),
    getSupervisor(ctx.supabase),
    getOverview(ctx.supabase),
    ctx.supabase.rpc("dashboard_counts"),
  ]);
  const c = (countsRes.data ?? {}) as Partial<DashboardCounts>;
  const counts: DashboardCounts = {
    cmdb: c.cmdb ?? 0, integrations: c.integrations ?? 0, processes: c.processes ?? 0, products: c.products ?? 0, ledger: c.ledger ?? 0,
  };
  const firstName = ctx.name.trim().split(/\s+/)[0] || ctx.name;

  return <OperationsTower tower={tower} supervisor={supervisor} overview={overview} counts={counts} firstName={firstName} />;
}
