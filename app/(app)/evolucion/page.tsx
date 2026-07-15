import { getContext } from "@/lib/auth/context";
import { getEvolutionHome, getEvolutionDecisions } from "@/lib/evolution/queries";
import { listPortfolio, listSquadCapacity } from "@/lib/projects/queries";
import { listTribes } from "@/lib/tribes/queries";
import { getBehaviorAnalysis } from "@/lib/analytics/queries";
import { portfolioRoi, tribeLoads } from "@/lib/projects/portfolio";
import { EvolutionHome } from "@/components/evolution/evolution-home";

// Torre de Control del Gerente de Evolucion. Bandeja de decisiones (accion) + pipeline
// incidencia->entrega + riesgo/valor + tendencia. Todo dato real y agregado (RPC gateados).
export default async function EvolutionHomePage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [home, decisions, rows, squads, tribes, behavior] = await Promise.all([
    getEvolutionHome(ctx.supabase),
    getEvolutionDecisions(ctx.supabase),
    listPortfolio(ctx.supabase),
    listSquadCapacity(ctx.supabase),
    listTribes(ctx.supabase),
    getBehaviorAnalysis(ctx.supabase, "category", 12),
  ]);
  const roi = portfolioRoi(rows);
  const tLoads = tribeLoads(tribes.map((t) => ({ id: t.id, name: t.name, code: t.code })), squads, rows);
  const firstName = ctx.name.trim().split(/\s+/)[0] || ctx.name;
  return (
    <EvolutionHome
      home={home}
      decisions={decisions}
      roi={{ estRoi: roi.estRoi, realRoi: roi.realRoi, measured: roi.measured, total: roi.total }}
      tribes={tLoads}
      trend={behavior.trend ?? []}
      projection={behavior.projection?.next_week ?? null}
      firstName={firstName}
    />
  );
}
