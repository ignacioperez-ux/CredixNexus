import type { SupabaseClient } from "@supabase/supabase-js";
import { coverageLabel } from "@/lib/process/validation";

// Gobierno de datos. RLS aisla por tenant. Ficha de proceso + matrices.

export type ProcessRow = {
  id: string; code: string; name: string; process_level: string; business_unit: string | null;
  system_count: number; coverage: string;
};
export type ProcessStats = { total: number; macro: number; without_systems: number };

export async function listProcesses(supabase: SupabaseClient): Promise<{ rows: ProcessRow[]; stats: ProcessStats }> {
  const { data, error } = await supabase
    .from("process")
    .select("id, code, name, process_level, owner:business_unit_id(name), links:process_system(count)")
    .neq("status", "deleted")
    .order("process_level")
    .order("name");
  if (error) throw new Error(error.message);
  const rows: ProcessRow[] = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const bu = row.owner as { name: string } | null;
    const links = row.links as { count: number }[] | null;
    const count = links?.[0]?.count ?? 0;
    return {
      id: row.id as string, code: row.code as string, name: row.name as string,
      process_level: row.process_level as string, business_unit: bu?.name ?? null,
      system_count: count, coverage: coverageLabel(count),
    };
  });
  return {
    rows,
    stats: {
      total: rows.length,
      macro: rows.filter((r) => r.process_level === "macro").length,
      without_systems: rows.filter((r) => r.system_count === 0).length,
    },
  };
}

export type ProcessSystemLink = { id: string; ci_id: string; ci_name: string; ci_type: string; role: string; criticality: string };
export type ProcessDetail = {
  process: { id: string; code: string; name: string; process_level: string; objective: string | null; business_unit: string | null; parent: { id: string; name: string } | null };
  children: { id: string; name: string; process_level: string }[];
  systems: ProcessSystemLink[];
};

export async function getProcess(supabase: SupabaseClient, id: string): Promise<ProcessDetail | null> {
  const { data, error } = await supabase
    .from("process")
    .select("id, code, name, process_level, objective, owner:business_unit_id(name), parent:parent_process_id(id, name)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;

  const [{ data: kids }, { data: sys }] = await Promise.all([
    supabase.from("process").select("id, name, process_level").eq("parent_process_id", id).order("name"),
    supabase.from("process_system").select("id, role, criticality, ci:ci_id(id, name, ci_type)").eq("process_id", id),
  ]);

  const systems: ProcessSystemLink[] = (sys ?? []).map((s) => {
    const r = s as Record<string, unknown>;
    const ci = r.ci as { id: string; name: string; ci_type: string } | null;
    return { id: r.id as string, ci_id: ci?.id ?? "", ci_name: ci?.name ?? "—", ci_type: ci?.ci_type ?? "", role: r.role as string, criticality: r.criticality as string };
  }).sort((a, b) => a.ci_name.localeCompare(b.ci_name));

  const bu = row.owner as { name: string } | null;
  const parent = row.parent as { id: string; name: string } | null;
  return {
    process: {
      id: row.id as string, code: row.code as string, name: row.name as string, process_level: row.process_level as string,
      objective: (row.objective as string | null) ?? null, business_unit: bu?.name ?? null, parent,
    },
    children: (kids ?? []) as { id: string; name: string; process_level: string }[],
    systems,
  };
}

/** Sistemas (CIs) disponibles para vincular (selector del editor). */
export async function listSystems(supabase: SupabaseClient): Promise<{ id: string; name: string; ci_type: string }[]> {
  const { data, error } = await supabase.from("configuration_item").select("id, name, ci_type").neq("status", "deleted").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string; ci_type: string }[];
}

// ---- Matriz producto -> canal ----
export type PcCell = { product_id: string; channel_id: string; availability: string; link_id: string };
export type ProductChannelMatrix = {
  products: { id: string; name: string }[];
  channels: { id: string; name: string }[];
  cells: PcCell[];
  covered: number;
};

export async function getProductChannelMatrix(supabase: SupabaseClient): Promise<ProductChannelMatrix> {
  const [{ data: products, error: pe }, { data: channels, error: ce }, { data: links, error: le }] = await Promise.all([
    supabase.from("product").select("id, name").neq("status", "deleted").order("name"),
    supabase.from("channel").select("id, name").neq("status", "deleted").order("name"),
    supabase.from("product_channel").select("id, product_id, channel_id, availability"),
  ]);
  for (const e of [pe, ce, le]) if (e) throw new Error(e.message);
  const cells: PcCell[] = (links ?? []).map((l) => {
    const r = l as Record<string, unknown>;
    return { product_id: r.product_id as string, channel_id: r.channel_id as string, availability: r.availability as string, link_id: r.id as string };
  });
  return {
    products: (products ?? []) as { id: string; name: string }[],
    channels: (channels ?? []) as { id: string; name: string }[],
    cells,
    covered: cells.length,
  };
}
