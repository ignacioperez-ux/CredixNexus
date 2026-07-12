import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, getSessionUser, getSessionAccount } from "@/lib/auth/session";

/** Verifica si el usuario autenticado tiene un permiso (via SQL has_permission). */
export async function hasPermission(supabase: SupabaseClient, code: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_permission", { p_code: code });
  return data === true;
}

/** Contexto de sesion server-side: cliente supabase, usuario, y su tenant/cuenta.
 *  Devuelve null si no hay sesion. Reutiliza la sesion cacheada por request (session.ts):
 *  no repite getUser() ni la query a user_account que ya hizo el layout. */
export async function getContext() {
  const user = await getSessionUser();
  if (!user) return null;

  const [supabase, account] = await Promise.all([getSupabase(), getSessionAccount()]);

  return {
    supabase,
    user,
    accountId: account?.id ?? null,
    tenantId: account?.tenant_id ?? null,
    partyId: account?.party_id ?? null,
    name: account?.full_name ?? user.email ?? "Usuario",
  };
}
