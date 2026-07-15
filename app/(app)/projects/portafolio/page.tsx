import { getContext } from "@/lib/auth/context";
import { listPortfolio } from "@/lib/projects/queries";
import { getSquadCapacities } from "@/lib/capacity/queries";
import { PortfolioCockpit } from "@/components/projects/portfolio";

// Portafolio: cockpit estrategico del Gerente de Evolucion. WSJF desglosado, ROI estimado vs real,
// roadmap y capacidad prospectiva por TRIBU -> squad -> proyecto. Dato real (project.read + RLS).
// La capacidad (demanda/carga) sale de la FUENTE UNICA (lib/capacity): mismos numeros que la Torre,
// /squads, Squad 360 y /workload. El filtro por tribu llega en la URL (?tribe=<id>).
export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ tribe?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx) return null;
  const [rows, caps] = await Promise.all([
    listPortfolio(ctx.supabase),
    getSquadCapacities(ctx.supabase),
  ]);
  return <PortfolioCockpit rows={rows} caps={caps} initialTribe={sp.tribe ?? null} />;
}
