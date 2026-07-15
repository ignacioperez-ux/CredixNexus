import { getContext } from "@/lib/auth/context";
import { listPortfolio, listSquadCapacity } from "@/lib/projects/queries";
import { listTribes } from "@/lib/tribes/queries";
import { PortfolioCockpit } from "@/components/projects/portfolio";

// Portafolio: cockpit estrategico del Gerente de Evolucion. WSJF desglosado, ROI estimado vs real,
// roadmap y capacidad prospectiva por TRIBU -> squad -> proyecto. Dato real (project.read + RLS).
export default async function PortfolioPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [rows, squads, tribes] = await Promise.all([
    listPortfolio(ctx.supabase),
    listSquadCapacity(ctx.supabase),
    listTribes(ctx.supabase),
  ]);
  return <PortfolioCockpit rows={rows} squads={squads} tribes={tribes.map((t) => ({ id: t.id, name: t.name, code: t.code }))} />;
}
