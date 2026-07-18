import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFormSchema, type FormField } from "@/lib/catalog/validation";

// Catalogo de servicios. RLS aisla por tenant.

export type CatalogItem = {
  id: string; code: string; name: string; description: string | null; category: string;
  category_code: string | null; category_name_es: string | null; category_name_en: string | null;
  form_schema: FormField[]; sla_hours: number; status: string; has_workflow: boolean;
};

const ITEM_SELECT = "id, code, name, description, category, form_schema, sla_hours, status, workflow_definition_id, cat:category_id(code, name_es, name_en)";

function decorateItem(row: Record<string, unknown>): CatalogItem {
  const cat = row.cat as { code: string; name_es: string; name_en: string } | null;
  return {
    id: row.id as string, code: row.code as string, name: row.name as string,
    description: (row.description as string | null) ?? null, category: row.category as string,
    category_code: cat?.code ?? null, category_name_es: cat?.name_es ?? null, category_name_en: cat?.name_en ?? null,
    form_schema: normalizeFormSchema(row.form_schema), sla_hours: row.sla_hours as number,
    status: row.status as string, has_workflow: !!row.workflow_definition_id,
  };
}

export async function listCatalogItems(supabase: SupabaseClient, includeInactive = false): Promise<CatalogItem[]> {
  let q = supabase.from("service_item").select(ITEM_SELECT).order("name");
  if (!includeInactive) q = q.eq("status", "active");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => decorateItem(r as Record<string, unknown>));
}

export async function getCatalogItem(supabase: SupabaseClient, id: string): Promise<CatalogItem | null> {
  const { data, error } = await supabase.from("service_item").select(ITEM_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return decorateItem(data as Record<string, unknown>);
}

/** Maestro de categorias del catalogo (datos maestros §10, i18n ES/EN). */
export type ServiceCategory = { id: string; code: string; name_es: string; name_en: string; status: string; sort_order: number };
export async function listServiceCategories(supabase: SupabaseClient, includeInactive = false): Promise<ServiceCategory[]> {
  let q = supabase.from("service_category").select("id, code, name_es, name_en, status, sort_order").order("sort_order").order("name_es");
  if (!includeInactive) q = q.eq("status", "active");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceCategory[];
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
