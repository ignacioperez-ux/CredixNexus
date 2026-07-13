import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormField } from "@/lib/catalog/validation";

// Catalogo de servicios. RLS aisla por tenant.

export type CatalogItem = {
  id: string; code: string; name: string; description: string | null; category: string;
  form_schema: FormField[]; sla_hours: number; status: string; has_workflow: boolean;
};

export async function listCatalogItems(supabase: SupabaseClient, includeInactive = false): Promise<CatalogItem[]> {
  let q = supabase.from("service_item").select("id, code, name, description, category, form_schema, sla_hours, status, workflow_definition_id").order("name");
  if (!includeInactive) q = q.eq("status", "active");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string, code: row.code as string, name: row.name as string,
      description: (row.description as string | null) ?? null, category: row.category as string,
      form_schema: (row.form_schema as FormField[]) ?? [], sla_hours: row.sla_hours as number,
      status: row.status as string, has_workflow: !!row.workflow_definition_id,
    };
  });
}

export async function getCatalogItem(supabase: SupabaseClient, id: string): Promise<CatalogItem | null> {
  const { data, error } = await supabase
    .from("service_item")
    .select("id, code, name, description, category, form_schema, sla_hours, status, workflow_definition_id")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string, code: row.code as string, name: row.name as string,
    description: (row.description as string | null) ?? null, category: row.category as string,
    form_schema: (row.form_schema as FormField[]) ?? [], sla_hours: row.sla_hours as number,
    status: row.status as string, has_workflow: !!row.workflow_definition_id,
  };
}

export type RequestRow = {
  id: string; request_number: string; status: string; sla_due_at: string | null; created_at: string;
  item_name: string; incident_id: string; incident_number: string; incident_status: string;
  requester_name: string | null;
};
export type RequestStats = { open: number; fulfilled: number; overdue: number };

export async function listRequests(
  supabase: SupabaseClient,
  opts: { ownerId?: string | null; ownOnly?: boolean } = {},
): Promise<{ rows: RequestRow[]; stats: RequestStats }> {
  // Seguridad (P3 / UX-002): un solicitante sin gestion ve SOLO sus solicitudes, no todo el
  // tenant. Los gestores (service_catalog.manage) ven todas. Refuerza la RLS por propietario.
  if (opts.ownOnly && !opts.ownerId) return { rows: [], stats: { open: 0, fulfilled: 0, overdue: 0 } };
  let q = supabase
    .from("service_request")
    .select("id, request_number, status, sla_due_at, created_at, item:item_id(name), incident:incident_id(id, incident_number, status), requester:requested_by_user_id(full_name)")
    .order("created_at", { ascending: false });
  if (opts.ownOnly && opts.ownerId) q = q.eq("requested_by_user_id", opts.ownerId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const now = new Date().toISOString();
  const rows: RequestRow[] = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const item = row.item as { name: string } | null;
    const inc = row.incident as { id: string; incident_number: string; status: string } | null;
    const req = row.requester as { full_name: string } | null;
    return {
      id: row.id as string, request_number: row.request_number as string, status: row.status as string,
      sla_due_at: (row.sla_due_at as string | null) ?? null, created_at: row.created_at as string,
      item_name: item?.name ?? "—", incident_id: inc?.id ?? "", incident_number: inc?.incident_number ?? "—", incident_status: inc?.status ?? "—",
      requester_name: req?.full_name ?? null,
    };
  });
  return {
    rows,
    stats: {
      open: rows.filter((r) => r.status === "open").length,
      fulfilled: rows.filter((r) => r.status === "fulfilled").length,
      overdue: rows.filter((r) => r.status === "open" && r.sla_due_at && r.sla_due_at < now).length,
    },
  };
}

export async function getRequest(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("service_request")
    .select("*, item:item_id(name, code, form_schema, sla_hours), incident:incident_id(id, incident_number, title, status, priority), requester:requested_by_user_id(full_name)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
