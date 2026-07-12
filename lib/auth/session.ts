import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Sesion server-side deduplicada por request (React cache): el layout y las paginas
// comparten UNA sola resolucion de cliente/usuario/cuenta/permisos en vez de repetir
// getUser() y la query a user_account en cada capa. Reduce viajes a Supabase por render.

/** Un cliente Supabase por request. */
export const getSupabase = cache(async () => createClient());

export type SessionUser = { id: string; email: string | null };

/** Usuario autenticado (deduplicado por request). Usa getClaims(): verifica el JWT
 *  LOCALMENTE (sin viaje a Auth) cuando el proyecto usa llaves asimetricas; si no puede,
 *  cae a getUser(). El middleware ya refresco el token, asi que el JWT de la cookie es valido.
 *  Solo se usan id/email en toda la app. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await getSupabase();
  try {
    const { data } = await supabase.auth.getClaims();
    const c = data?.claims as { sub?: string; email?: string } | undefined;
    if (c?.sub) return { id: c.sub, email: c.email ?? null };
  } catch {
    /* cae al getUser de abajo */
  }
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
});

export type SessionAccount = {
  id: string;
  tenant_id: string;
  party_id: string | null;
  full_name: string | null;
  tenant: { name: string | null } | { name: string | null }[] | null;
};

/** Cuenta del usuario (una sola query por request; columnas unificadas layout + paginas). */
export const getSessionAccount = cache(async (): Promise<SessionAccount | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("user_account")
    .select("id, tenant_id, party_id, full_name, tenant:tenant_id(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return (data as SessionAccount | null) ?? null;
});

/** Nombre de tenant normalizado (la relacion puede venir como objeto o arreglo). */
export function tenantNameOf(account: SessionAccount | null): string {
  const rel = account?.tenant;
  const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  return name ?? "Credix Core";
}

/** Permisos + roles + flag admin del usuario (una sola resolucion por request).
 *  Un solo viaje a Supabase via my_access() (antes eran 2: my_permissions + my_roles). */
export const getAccessControl = cache(async () => {
  const supabase = await getSupabase();
  const { data } = await supabase.rpc("my_access");
  const d = (data as { perms?: string[]; roles?: string[] } | null) ?? {};
  const roleList = d.roles ?? [];
  return {
    perms: d.perms ?? [],
    roles: roleList,
    isAdmin: roleList.includes("system_admin") || roleList.includes("tenant_admin"),
  };
});
