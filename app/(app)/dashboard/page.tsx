import { getSupabase } from "@/lib/auth/session";
import { KpiGrid, type DashboardCounts } from "@/components/dashboard/kpi-grid";

export default async function DashboardPage() {
  const supabase = await getSupabase();

  // Conteos reales bajo RLS (el usuario solo ve su tenant), consolidados en 1 RPC (0073).
  const { data } = await supabase.rpc("dashboard_counts");
  const c = (data ?? {}) as Partial<DashboardCounts>;

  const counts: DashboardCounts = {
    apps: c.apps ?? 0,
    systems: c.systems ?? 0,
    processes: c.processes ?? 0,
    products: c.products ?? 0,
    ledger: c.ledger ?? 0,
  };

  return <KpiGrid counts={counts} />;
}
