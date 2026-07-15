import { getContext } from "@/lib/auth/context";
import { getEvolutionHome, getEvolutionDecisions } from "@/lib/evolution/queries";
import { listPortfolio } from "@/lib/projects/queries";
import { getBehaviorAnalysis } from "@/lib/analytics/queries";
import { portfolioRoi } from "@/lib/projects/portfolio";
import { getSquadCapacities } from "@/lib/capacity/queries";
import { tribeCapacities } from "@/lib/capacity/compute";
import { EvolutionHome } from "@/components/evolution/evolution-home";

// Torre de Control del Gerente de Evolucion. Bandeja de decisiones (accion) + pipeline
// incidencia->entrega + riesgo/valor + tendencia. Todo dato real y agregado (RPC gateados).
// La capacidad por tribu sale de la FUENTE UNICA (lib/capacity) — mismos numeros que /squads,
// Squad 360 y /workload (§0).
export default async function EvolutionHomePage() {
  const ctx = await getContext();
  if (!ctx) return null;
  // La tendencia (analytics) es un apoyo, no el corazon de la Torre: si el RPC falla o el rol no
  // tiene el permiso, se degrada sin tendencia en vez de tumbar toda la pantalla (nunca "saca del app").
  const [home, decisions, rows, caps, behavior] = await Promise.all([
    getEvolutionHome(ctx.supabase),
    getEvolutionDecisions(ctx.supabase),
    listPortfolio(ctx.supabase),
    getSquadCapacities(ctx.supabase),
    getBehaviorAnalysis(ctx.supabase, "category", 12).catch(() => ({ trend: [] as { week: string; count: number }[], projection: null as { next_week: number } | null })),
  ]);
  const roi = portfolioRoi(rows);
  const tLoads = tribeCapacities(caps).map((tc) => ({
    id: tc.id, name: tc.name, code: tc.code, squadIds: [] as string[], capacity: tc.capacity_points,
    committed: tc.demand_points, projects: 0, squads: tc.squads, loadPct: tc.load_pct, over: tc.over, avgWsjf: 0,
  }));
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
