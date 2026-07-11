import type { SupabaseClient } from "@supabase/supabase-js";

// Consultas del modulo de incidentes. RLS filtra por tenant automaticamente;
// igual mantenemos las consultas acotadas al contexto del usuario (CLAUDE.md §3.2 #6).

export type IncidentRow = {
  id: string;
  incident_number: string;
  title: string;
  status: string;
  priority: string;
  case_type: string;
  transformation_score: number;
  transformation_candidate: boolean;
  opened_at: string;
  resolved_at: string | null;
  sla_resolution_due_at: string | null;
  category: { name: string } | null;
  ci: { name: string } | null;
  business_unit: { name: string } | null;
};

export async function listIncidents(supabase: SupabaseClient): Promise<IncidentRow[]> {
  const { data, error } = await supabase
    .from("incident")
    .select(
      "id, incident_number, title, status, priority, case_type, transformation_score, transformation_candidate, opened_at, resolved_at, sla_resolution_due_at, category:category_id(name), ci:affected_ci_id(name), business_unit:affected_business_unit_id(name)",
    )
    .order("transformation_score", { ascending: false })
    .order("opened_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as IncidentRow[];
}

export type CaseTypeMeta = Record<string, { name: string; domain: string }>;

/** Mapa code -> {name, domain} de los tipos de caso (para clasificar Negocio vs TI). */
export async function getCaseTypeMeta(supabase: SupabaseClient): Promise<CaseTypeMeta> {
  const { data } = await supabase.from("case_type").select("code, name, domain").eq("status", "active");
  const map: CaseTypeMeta = {};
  for (const c of (data ?? []) as { code: string; name: string; domain: string }[]) {
    map[c.code] = { name: c.name, domain: c.domain };
  }
  return map;
}

export async function getIncident(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("incident")
    .select(
      `*,
       category:category_id(name, default_team, requires_rca, requires_kb),
       ci:affected_ci_id(name, ci_type),
       service:affected_service_id(name),
       product:affected_product_id(name),
       channel:affected_channel_id(name),
       business_unit:affected_business_unit_id(name),
       reporter:reported_by_user_id(full_name),
       area:delivery_area_id(name, code)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getComments(supabase: SupabaseClient, incidentId: string) {
  const { data, error } = await supabase
    .from("incident_comment")
    .select("id, body, visibility, is_system_generated, created_at, author:author_user_id(full_name)")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLedgerForEntity(supabase: SupabaseClient, entityId: string) {
  const { data, error } = await supabase
    .from("immutable_audit_event")
    .select("block_height, action, actor_type, current_hash, timestamp")
    .eq("entity_id", entityId)
    .order("block_height", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type FormOptions = {
  categories: { id: string; name: string; default_priority: string | null }[];
  apps: { id: string; name: string }[];
  services: { id: string; name: string }[];
  products: { id: string; name: string }[];
  channels: { id: string; name: string }[];
  businessUnits: { id: string; name: string }[];
  caseTypes: { code: string; name: string }[];
};

export type KbSuggestion = { id: string; article_number: string; title: string; category: string; source_incident_id: string | null };

/** Conocimiento sugerido al triar: articulos activos que coinciden con la categoria del
 *  incidente o con incidentes previos sobre la misma aplicacion (¿ya resuelto?). */
export async function getSuggestedKnowledge(
  supabase: SupabaseClient,
  category: string | null,
  ciId: string | null,
): Promise<KbSuggestion[]> {
  const found = new Map<string, KbSuggestion>();

  if (category) {
    const { data } = await supabase
      .from("knowledge_article")
      .select("id, article_number, title, category, source_incident_id")
      .eq("status", "active")
      .eq("category", category)
      .limit(5);
    (data ?? []).forEach((a) => found.set(a.id as string, a as KbSuggestion));
  }

  if (ciId) {
    // Articulos cuyo incidente origen afectaba la misma aplicacion
    const { data: prior } = await supabase.from("incident").select("id").eq("affected_ci_id", ciId).limit(50);
    const ids = (prior ?? []).map((i) => i.id as string);
    if (ids.length > 0) {
      const { data } = await supabase
        .from("knowledge_article")
        .select("id, article_number, title, category, source_incident_id")
        .eq("status", "active")
        .in("source_incident_id", ids)
        .limit(5);
      (data ?? []).forEach((a) => found.set(a.id as string, a as KbSuggestion));
    }
  }

  return [...found.values()];
}

export async function getFormOptions(supabase: SupabaseClient): Promise<FormOptions> {
  const [categories, apps, services, products, channels, businessUnits, caseTypes] = await Promise.all([
    supabase.from("incident_category").select("id, name, default_priority").eq("status", "active").order("name"),
    supabase.from("configuration_item").select("id, name").eq("ci_type", "application").eq("status", "active").order("name"),
    supabase.from("service").select("id, name").eq("status", "active").order("name"),
    supabase.from("product").select("id, name").eq("status", "active").order("name"),
    supabase.from("channel").select("id, name").eq("status", "active").order("name"),
    supabase.from("business_unit").select("id, name").eq("status", "active").order("name"),
    supabase.from("case_type").select("code, name").eq("status", "active").order("name"),
  ]);
  return {
    categories: (categories.data ?? []) as FormOptions["categories"],
    apps: (apps.data ?? []) as FormOptions["apps"],
    services: (services.data ?? []) as FormOptions["services"],
    products: (products.data ?? []) as FormOptions["products"],
    channels: (channels.data ?? []) as FormOptions["channels"],
    businessUnits: (businessUnits.data ?? []) as FormOptions["businessUnits"],
    caseTypes: (caseTypes.data ?? []) as FormOptions["caseTypes"],
  };
}
