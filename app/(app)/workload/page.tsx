import { getContext } from "@/lib/auth/context";
import { getWorkload } from "@/lib/workload/queries";
import { getSimulationInputs } from "@/lib/workload/simulation";
import { getSquadCapacities } from "@/lib/capacity/queries";
import { WorkloadView } from "@/components/workload/workload-view";
import { Simulation } from "@/components/workload/simulation";

export default async function WorkloadPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  // Capacidad por squad desde la FUENTE UNICA (§0): mismos numeros que /squads, Squad 360, Torre.
  const [data, simInputs, squads] = await Promise.all([getWorkload(ctx.supabase), getSimulationInputs(ctx.supabase), getSquadCapacities(ctx.supabase)]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <WorkloadView data={data} squads={squads} />
      <Simulation inputs={simInputs} />
    </div>
  );
}
