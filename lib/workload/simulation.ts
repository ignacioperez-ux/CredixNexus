import type { SupabaseClient } from "@supabase/supabase-js";

export type BacklogItem = {
  id: string;
  name: string;
  squadId: string | null;
  squadName: string;
  size: number;
  wsjf: number;
  status: string;
};
export type SimSquad = { id: string; name: string; capacity: number };
export type SimulationInputs = { squads: SimSquad[]; backlog: BacklogItem[] };

export async function getSimulationInputs(supabase: SupabaseClient): Promise<SimulationInputs> {
  const [squadRes, projRes] = await Promise.all([
    supabase.from("squad").select("id, name, capacity_points").eq("status", "active").order("name"),
    supabase
      .from("project")
      .select("id, name, status, job_size, wsjf, squad_id, squad:squad_id(name)")
      .in("status", ["proposed", "approved", "active", "on_hold"]),
  ]);

  const squads: SimSquad[] = ((squadRes.data ?? []) as { id: string; name: string; capacity_points: number }[]).map((s) => ({
    id: s.id,
    name: s.name,
    capacity: s.capacity_points,
  }));

  const backlog: BacklogItem[] = ((projRes.data ?? []) as unknown as {
    id: string; name: string; status: string; job_size: number; wsjf: number; squad_id: string | null; squad: { name: string } | null;
  }[]).map((p) => ({
    id: p.id,
    name: p.name,
    squadId: p.squad_id,
    squadName: p.squad?.name ?? "—",
    size: p.job_size ?? 1,
    wsjf: Number(p.wsjf ?? 0),
    status: p.status,
  }));

  return { squads, backlog };
}
