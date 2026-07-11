import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Verifica si el usuario autenticado tiene un permiso (via SQL has_permission). */
export async function hasPermission(supabase: SupabaseClient, code: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_permission", { p_code: code });
  return data === true;
}

/** Contexto de sesion server-side: cliente supabase, usuario, y su tenant/cuenta.
 *  Devuelve null si no hay sesion. */
export async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: account } = await supabase
    .from("user_account")
    .select("id, tenant_id, party_id, full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    accountId: (account?.id as string | undefined) ?? null,
    tenantId: (account?.tenant_id as string | undefined) ?? null,
    partyId: (account?.party_id as string | undefined) ?? null,
    name: (account?.full_name as string | undefined) ?? user.email ?? "Usuario",
  };
}
