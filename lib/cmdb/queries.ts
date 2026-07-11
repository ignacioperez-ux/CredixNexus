import type { SupabaseClient } from "@supabase/supabase-js";

// CMDB: inventario de elementos de configuracion (aplicaciones y sistemas).

export type CiRow = {
  id: string;
  name: string;
  ci_type: string;
  status: string;
  vendor: { name: string } | null;
};

export async function listConfigItems(supabase: SupabaseClient): Promise<CiRow[]> {
  const { data, error } = await supabase
    .from("configuration_item")
    .select("id, name, ci_type, status, vendor:vendor_id(name)")
    .neq("status", "deleted")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CiRow[];
}
