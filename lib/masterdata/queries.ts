import type { SupabaseClient } from "@supabase/supabase-js";
import { type Catalog } from "./registry";

export async function listRecords(
  supabase: SupabaseClient,
  catalog: Catalog,
  opts: { search?: string; includeInactive?: boolean } = {},
) {
  const cols = ["id", "code", "name", "status", ...catalog.listCols];
  let q = supabase.from(catalog.table).select(cols.join(", ")).order("name", { ascending: true }).limit(500);
  if (!opts.includeInactive) q = q.eq("status", "active");
  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim();
    q = q.or(`code.ilike.%${s}%,name.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Record<string, unknown>[];
}

export async function getRecord(supabase: SupabaseClient, catalog: Catalog, id: string) {
  const { data, error } = await supabase.from(catalog.table).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

export type FkOptions = Record<string, { id: string; name: string }[]>;

/** Carga las opciones de cada campo FK del catálogo, desde la BD (no hardcode). */
export async function getCatalogFkOptions(supabase: SupabaseClient, catalog: Catalog): Promise<FkOptions> {
  const fkFields = catalog.fields.filter((f) => f.type === "fk" && f.fkTable);
  const result: FkOptions = {};
  await Promise.all(
    fkFields.map(async (f) => {
      const { data } = await supabase.from(f.fkTable as string).select("id, name").eq("status", "active").order("name").limit(500);
      result[f.name] = (data ?? []) as { id: string; name: string }[];
    }),
  );
  return result;
}
