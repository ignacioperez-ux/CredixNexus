import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, getSessionUser, getSessionAccount, getAccessControl } from "@/lib/auth/session";

/** Verifica si el usuario autenticado tiene un permiso. Reutiliza la resolucion de acceso
 *  cacheada por request (getAccessControl -> 1 sola RPC my_access) en vez de una RPC
 *  has_permission por cada llamada. Incluye bypass admin (system_admin/tenant_admin),
 *  consistente con el nav/guards. El parametro supabase se mantiene por compatibilidad. */
export async function hasPermission(_supabase: SupabaseClient, code: string): Promise<boolean> {
  const access = await getAccessControl();
  return access.isAdmin || access.perms.includes(code);
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
