import type { SupabaseClient } from "@supabase/supabase-js";

export async function getActiveRuleConfig(supabase: SupabaseClient) {
  const { data: rule } = await supabase
    .from("rule")
    .select("id, code, name, description")
    .eq("rule_type", "transformation")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!rule) return null;

  const { data: version } = await supabase
    .from("rule_version")
    .select("version_number, weights_json, thresholds_json, status")
    .eq("rule_id", rule.id)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: links } = await supabase
    .from("governance_link")
    .select("governance_item:governance_item_id(item_type, code, name)")
    .eq("entity_type", "rule")
    .eq("entity_id", rule.id);

  const governance = (links ?? [])
    .map((l) => l.governance_item as unknown as { item_type: string; code: string; name: string } | null)
    .filter(Boolean) as { item_type: string; code: string; name: string }[];

  return { rule, version, governance };
}

export type RecommendationRow = {
  id: string;
  transformation_score: number;
  recommended_name: string;
  recommendation_status: string;
  business_priority: number | null;
  review_reason: string | null;
  incident: { incident_number: string; title: string; id: string } | null;
};

export async function getRecommendations(supabase: SupabaseClient): Promise<RecommendationRow[]> {
  const { data, error } = await supabase
    .from("project_recommendation")
    .select(
      "id, transformation_score, recommended_name, recommendation_status, business_priority, review_reason, incident:incident_id(id, incident_number, title)",
    )
    .order("recommendation_status", { ascending: true })
    .order("business_priority", { ascending: true, nullsFirst: false })
    .order("transformation_score", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RecommendationRow[];
}
