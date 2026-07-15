import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getTalentProfiles, getTalentAreas } from "@/lib/talent/queries";
import { getWorkload } from "@/lib/workload/queries";
import { TalentList } from "@/components/talent/talent-list";

export default async function TalentPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [profiles, areas, access, workload] = await Promise.all([
    getTalentProfiles(ctx.supabase),
    getTalentAreas(ctx.supabase),
    getAccessControl(),
    getWorkload(ctx.supabase),
  ]);
  const canManage = access.isAdmin || access.perms.includes("talent.manage");
  // Carga por persona desde la MISMA fuente que /workload (§0): puntos de tareas abiertas.
  const load: Record<string, number> = {};
  for (const m of workload.members) load[m.id] = m.taskPoints;
  return <TalentList profiles={profiles} areas={areas} canManage={canManage} load={load} />;
}
