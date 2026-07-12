import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Sesion server-side deduplicada por request (React cache): el layout y las paginas
// comparten UNA sola resolucion de cliente/usuario/cuenta/permisos en vez de repetir
// getUser() y la query a user_account en cada capa. Reduce viajes a Supabase por render.

/** Un cliente Supabase por request. */
export const getSupabase = cache(async () => createClient());

/** Usuario autenticado (una sola llamada a Auth por request). */
export const getSessionUser = cache(async () => {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
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

/** Permisos + roles + flag admin del usuario (una sola resolucion por request). */
export const getAccessControl = cache(async () => {
  const supabase = await getSupabase();
  const [{ data: perms }, { data: roles }] = await Promise.all([
    supabase.rpc("my_permissions"),
    supabase.rpc("my_roles"),
  ]);
  const roleList = (roles as string[] | null) ?? [];
  return {
    perms: (perms as string[] | null) ?? [],
    roles: roleList,
    isAdmin: roleList.includes("system_admin") || roleList.includes("tenant_admin"),
  };
});
