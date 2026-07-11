import { createClient } from "@/lib/supabase/server";
import { KpiGrid, type DashboardCounts } from "@/components/dashboard/kpi-grid";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Conteos reales bajo RLS (el usuario solo ve su tenant).
  const head = { count: "exact" as const, head: true };
  const [apps, systems, processes, products, ledger] = await Promise.all([
    supabase.from("configuration_item").select("*", head).eq("ci_type", "application"),
    supabase.from("configuration_item").select("*", head).eq("ci_type", "system"),
    supabase.from("process").select("*", head),
    supabase.from("product").select("*", head),
    supabase.from("immutable_audit_event").select("*", head),
  ]);

  const counts: DashboardCounts = {
    apps: apps.count ?? 0,
    systems: systems.count ?? 0,
    processes: processes.count ?? 0,
    products: products.count ?? 0,
    ledger: ledger.count ?? 0,
  };

  return <KpiGrid counts={counts} />;
}
