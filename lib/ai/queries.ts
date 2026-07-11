import type { SupabaseClient } from "@supabase/supabase-js";

export type AiInteraction = {
  id: string;
  agent_name: string;
  model_name: string;
  action_type: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  human_review_required: boolean;
  created_at: string;
  output_json: { usage?: { output?: number } } | null;
};

export async function getAiInteractions(supabase: SupabaseClient, limit = 50): Promise<AiInteraction[]> {
  const { data, error } = await supabase
    .from("agent_action")
    .select("id, agent_name, model_name, action_type, related_entity_type, related_entity_id, human_review_required, created_at, output_json")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AiInteraction[];
}
