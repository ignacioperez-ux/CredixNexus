import { getContext } from "@/lib/auth/context";
import { getWorkload } from "@/lib/workload/queries";
import { getSimulationInputs } from "@/lib/workload/simulation";
import { WorkloadView } from "@/components/workload/workload-view";
import { Simulation } from "@/components/workload/simulation";

export default async function WorkloadPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [data, simInputs] = await Promise.all([getWorkload(ctx.supabase), getSimulationInputs(ctx.supabase)]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <WorkloadView data={data} />
      <Simulation inputs={simInputs} />
    </div>
  );
}
