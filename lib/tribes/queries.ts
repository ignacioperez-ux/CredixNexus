import type { SupabaseClient } from "@supabase/supabase-js";
import type { SquadType } from "./validation";

// Tribus + squads para el Mapa de Tribus. RLS aisla por tenant.
export type TribeRow = {
  id: string; code: string; name: string; mission: string | null; value_stream: string | null;
  objective: string | null; tribe_lead_user_id: string | null; status: string;
};
export type SquadLite = {
  id: string; code: string; name: string; squad_type: SquadType; tribe_id: string | null;
  is_transversal: boolean; capacity_points: number | null; status: string; type_locked: boolean;
};

export async function listTribes(supabase: SupabaseClient): Promise<TribeRow[]> {
  const { data, error } = await supabase
    .from("tribe")
    .select("id, code, name, mission, value_stream, objective, tribe_lead_user_id, status")
    .neq("status", "deleted")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as TribeRow[];
}

export async function listSquadsLite(supabase: SupabaseClient): Promise<SquadLite[]> {
  const { data, error } = await supabase
    .from("squad")
    .select("id, code, name, squad_type, tribe_id, is_transversal, capacity_points, status, type_locked")
    .neq("status", "deleted")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as SquadLite[];
}
