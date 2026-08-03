import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getTalentProfiles, getTalentAreas } from "@/lib/talent/queries";
import { getWorkload } from "@/lib/workload/queries";
import { getSimulationInputs } from "@/lib/workload/simulation";
import { getSquadCapacities } from "@/lib/capacity/queries";
import { isRouteDeniedForRoles } from "@/lib/nav/access";
import { AgentsAndLoad } from "@/components/team/agents-and-load";

// Fusion "Agentes y carga" (Fase B): Agentes (Talento) + pestana Carga (Workload + Simulacion) para
// quien tiene squad.read. Sin squad.read se ve solo Agentes. /workload sigue existiendo para otros roles.
export default async function TalentPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const access = await getAccessControl();
  // La pestana Carga replica el control de acceso de /workload: perm squad.read Y no vedado por persona.
  const canLoad = (access.isAdmin || access.perms.includes("squad.read")) && !isRouteDeniedForRoles("/workload", access.roles);
  const [profiles, areas, workload, simInputs, squads] = await Promise.all([
    getTalentProfiles(ctx.supabase),
    getTalentAreas(ctx.supabase),
    getWorkload(ctx.supabase),
    canLoad ? getSimulationInputs(ctx.supabase) : Promise.resolve(null),
    canLoad ? getSquadCapacities(ctx.supabase) : Promise.resolve(null),
  ]);
  const canManage = access.isAdmin || access.perms.includes("talent.manage");
  // Carga por persona desde la MISMA fuente que /workload (§0): puntos de tareas abiertas.
  const load: Record<string, number> = {};
  for (const m of workload.members) load[m.id] = m.taskPoints;
  return (
    <AgentsAndLoad
      agents={{ profiles, areas, canManage, load }}
      load={canLoad && simInputs && squads ? { data: workload, squads, simInputs } : null}
    />
  );
}
