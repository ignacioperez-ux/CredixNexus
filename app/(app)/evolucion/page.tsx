import { getContext } from "@/lib/auth/context";
import { getEvolutionHome } from "@/lib/evolution/queries";
import { listPortfolio, listSquadCapacity } from "@/lib/projects/queries";
import { listTribes } from "@/lib/tribes/queries";
import { portfolioRoi, tribeLoads } from "@/lib/projects/portfolio";
import { EvolutionHome } from "@/components/evolution/evolution-home";

// Home de Evolucion (Fase 2): cockpit del rol. Une funnel incidencia->evolucion, portafolio
// (ROI + capacidad por tribu), salud de iniciativas y senales de causa-raiz. Dato real.
export default async function EvolutionHomePage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [home, rows, squads, tribes] = await Promise.all([
    getEvolutionHome(ctx.supabase),
    listPortfolio(ctx.supabase),
    listSquadCapacity(ctx.supabase),
    listTribes(ctx.supabase),
  ]);
  const roi = portfolioRoi(rows);
  const tLoads = tribeLoads(tribes.map((t) => ({ id: t.id, name: t.name, code: t.code })), squads, rows);
  return <EvolutionHome home={home} roi={{ estRoi: roi.estRoi, realRoi: roi.realRoi, total: roi.total }} tribes={tLoads} />;
}
