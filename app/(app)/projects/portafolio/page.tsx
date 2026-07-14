import { getContext } from "@/lib/auth/context";
import { listPortfolio, listSquadCapacity } from "@/lib/projects/queries";
import { PortfolioCockpit } from "@/components/projects/portfolio";

// Portafolio (Fase Evolucion 1.4): cockpit estrategico del Gerente de Evolucion. WSJF desglosado,
// ROI estimado vs real, roadmap y capacidad prospectiva por squad. Dato real (project.read + RLS).
export default async function PortfolioPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [rows, squads] = await Promise.all([
    listPortfolio(ctx.supabase),
    listSquadCapacity(ctx.supabase),
  ]);
  return <PortfolioCockpit rows={rows} squads={squads} />;
}
