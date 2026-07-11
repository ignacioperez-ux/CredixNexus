import type { SupabaseClient } from "@supabase/supabase-js";

// Areas de entrega (Operaciones / Evolucion). RLS aisla por tenant.

export type AreaRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  lead_name: string | null;
  lead_email: string | null;
  deputy_name: string | null;
  deputy_email: string | null;
  status: string;
  incident_count: number;
  project_count: number;
};

export async function listDeliveryAreas(supabase: SupabaseClient): Promise<AreaRow[]> {
  const { data, error } = await supabase
    .from("delivery_area")
    .select("id, code, name, description, lead_name, lead_email, deputy_name, deputy_email, status, incidents:incident(count), projects:project(count)")
    .neq("status", "deleted")
    .order("code");
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => {
    const row = a as Record<string, unknown>;
    const inc = row.incidents as { count: number }[] | null;
    const prj = row.projects as { count: number }[] | null;
    delete row.incidents; delete row.projects;
    return { ...(row as unknown as Omit<AreaRow, "incident_count" | "project_count">), incident_count: inc?.[0]?.count ?? 0, project_count: prj?.[0]?.count ?? 0 };
  });
}
