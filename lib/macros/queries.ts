import type { SupabaseClient } from "@supabase/supabase-js";

// Macros / respuestas guardadas activas del tenant (compartidas). RLS filtra por tenant.
export type Macro = { id: string; name: string; body: string };

export async function listMacros(supabase: SupabaseClient): Promise<Macro[]> {
  const { data } = await supabase.from("macro").select("id, name, body").eq("status", "active").order("name");
  return (data ?? []) as Macro[];
}
