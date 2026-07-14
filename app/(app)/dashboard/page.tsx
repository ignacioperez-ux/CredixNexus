import { redirect } from "next/navigation";
import { getSupabase, getAccessControl } from "@/lib/auth/session";
import { getOverview, getSupervisor } from "@/lib/analytics/queries";
import { type DashboardCounts } from "@/components/dashboard/kpi-grid";
import { CommandCenter } from "@/components/dashboard/command-center";

export default async function DashboardPage() {
  // Defense-in-depth (ademas del guard de ruta del layout): el dashboard es de staff. El usuario
  // final (sin incident.read) se redirige a su home (/start -> /portal), nunca ve el dashboard total.
  const access = await getAccessControl();
  if (!access.isAdmin && !access.perms.includes("incident.read")) redirect("/start");
  const supabase = await getSupabase();

  // Datos reales bajo RLS (solo el tenant del usuario), en paralelo:
  // conteos de inventario (1 RPC, 0073) + operativa (supervisor_metrics + analytics_overview).
  const [countsRes, supervisor, overview] = await Promise.all([
    supabase.rpc("dashboard_counts"),
    getSupervisor(supabase),
    getOverview(supabase),
  ]);
  const c = (countsRes.data ?? {}) as Partial<DashboardCounts>;
  const counts: DashboardCounts = {
    apps: c.apps ?? 0, systems: c.systems ?? 0, processes: c.processes ?? 0, products: c.products ?? 0, ledger: c.ledger ?? 0,
  };

  return <CommandCenter overview={overview} supervisor={supervisor} counts={counts} />;
}
