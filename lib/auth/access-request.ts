"use server";

import { createClient } from "@/lib/supabase/server";

export type AccessRequestResult = { ok: boolean; error?: string; duplicate?: boolean };

/** Registra una solicitud de acceso para una identidad FEDERADA NO APROVISIONADA (RPC SECURITY
 *  DEFINER request_access_federated) y cierra la sesion para no dejar sesiones huerfanas.
 *  El email se toma del token en la RPC (no del cliente): no es falsificable. */
export async function requestFederatedAccess(fullName?: string): Promise<AccessRequestResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_access_federated", {
    p_full_name: fullName ?? null,
  });
  if (error) return { ok: false, error: error.message };

  // Cierra la sesion federada (no aprovisionada) tras registrar la solicitud.
  await supabase.auth.signOut({ scope: "global" });

  const d = (data ?? {}) as { duplicate?: boolean };
  return { ok: true, duplicate: !!d.duplicate };
}
