import type { SupabaseClient } from "@supabase/supabase-js";

// Vistas guardadas por usuario y modulo (scope). RLS aisla por tenant; el scope per-usuario
// se aplica aqui (user_id = cuenta actual), segun la convencion del repo.

export type SavedView = { id: string; name: string; filters: Record<string, unknown> };

export async function listSavedViews(supabase: SupabaseClient, accountId: string | null, scope: string): Promise<SavedView[]> {
  if (!accountId) return [];
  const { data } = await supabase
    .from("saved_view")
    .select("id, name, filters")
    .eq("user_id", accountId)
    .eq("scope", scope)
    .order("name");
  return (data ?? []) as SavedView[];
}
