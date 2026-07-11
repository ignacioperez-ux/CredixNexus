import type { SupabaseClient } from "@supabase/supabase-js";

// Cola de admision: casos aun sin triar (intake_status = pending).

export type PendingCaseRow = {
  id: string;
  incident_number: string;
  title: string;
  case_type: string;
  priority: string;
  opened_at: string;
  category: { name: string } | null;
  ci: { name: string } | null;
};

export async function listPendingCases(supabase: SupabaseClient): Promise<PendingCaseRow[]> {
  const { data, error } = await supabase
    .from("incident")
    .select("id, incident_number, title, case_type, priority, opened_at, category:category_id(name), ci:affected_ci_id(name)")
    .eq("intake_status", "pending")
    .order("opened_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PendingCaseRow[];
}
