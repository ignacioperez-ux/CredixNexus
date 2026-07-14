import type { SupabaseClient } from "@supabase/supabase-js";

// Vendor Management. RLS aisla por tenant; consultas acotadas al contexto.

export type VendorRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  criticality: string;
  status: string;
  contract_end: string | null;
  system_count: number;
};

export type VendorStats = { active: number; critical: number; expiringSoon: number };
export type VendorData = { vendors: VendorRow[]; stats: VendorStats };

export async function listVendors(supabase: SupabaseClient): Promise<VendorData> {
  const { data, error } = await supabase
    .from("vendor")
    .select("id, code, name, category, criticality, status, contract_end, systems:configuration_item(count)")
    .neq("status", "deleted")
    .order("name");
  if (error) throw new Error(error.message);
  const vendors: VendorRow[] = (data ?? []).map((v) => {
    const row = v as Record<string, unknown>;
    const sys = row.systems as { count: number }[] | null;
    delete row.systems;
    return { ...(row as unknown as Omit<VendorRow, "system_count">), system_count: sys?.[0]?.count ?? 0 };
  });
  const soon = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return {
    vendors,
    stats: {
      active: vendors.filter((v) => v.status === "active").length,
      critical: vendors.filter((v) => v.criticality === "critical" && v.status === "active").length,
      expiringSoon: vendors.filter((v) => v.status === "active" && v.contract_end && v.contract_end >= today && v.contract_end <= soon).length,
    },
  };
}

// Scorecard de proveedores (Fase Evolucion 1.5): senales agregadas por proveedor via RPC
// SECURITY DEFINER (gate vendor.read + tenant). Solo agregados, nunca filas individuales.
export type VendorScorecardRow = {
  id: string; code: string; name: string; category: string; criticality: string; status: string;
  contract_end: string | null; criticality_rank: number; days_to_expiry: number | null;
  systems: number; open_incidents: number; incidents_90d: number; open_alerts: number; open_disputes: number;
};

export async function getVendorScorecard(supabase: SupabaseClient): Promise<VendorScorecardRow[]> {
  const { data, error } = await supabase.rpc("vendor_scorecard");
  if (error) throw new Error(error.message);
  return (data ?? []) as VendorScorecardRow[];
}

export async function getVendor(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("vendor").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getVendorSystems(supabase: SupabaseClient, vendorId: string) {
  const { data, error } = await supabase
    .from("configuration_item")
    .select("id, name, ci_type")
    .eq("vendor_id", vendorId)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string; ci_type: string }[];
}

/** Incidentes que afectan sistemas de este proveedor (senal de desempeno). */
export async function getVendorIncidents(supabase: SupabaseClient, vendorId: string) {
  const { data: cis } = await supabase.from("configuration_item").select("id").eq("vendor_id", vendorId);
  const ids = (cis ?? []).map((c) => c.id as string);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("incident")
    .select("id, incident_number, title, status, priority, opened_at")
    .in("affected_ci_id", ids)
    .order("opened_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; incident_number: string; title: string; status: string; priority: string; opened_at: string }[];
}

/** Proveedor de un incidente via su CI afectado (chip en el detalle del caso). */
export async function getVendorForIncidentCi(supabase: SupabaseClient, ciId: string | null) {
  if (!ciId) return null;
  const { data } = await supabase.from("configuration_item").select("vendor:vendor_id(id, name, criticality)").eq("id", ciId).maybeSingle();
  const v = (data?.vendor ?? null) as unknown as { id: string; name: string; criticality: string } | null;
  return v;
}
