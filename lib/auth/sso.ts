"use client";

import type { createClient } from "@/lib/supabase/client";

// Feature flag de SSO (Entra ID). NEXT_PUBLIC_ -> se inlinea en build; con "false"/ausente la app
// es indistinguible de hoy (el boton federado ni se monta). Se enciende recien el dia D.
export const SSO_ENABLED = process.env.NEXT_PUBLIC_SSO_ENABLED === "true";

type Client = ReturnType<typeof createClient>;

/** Inicia el login federado con Azure/Entra ID (OIDC, PKCE). En exito el SDK redirige el navegador
 *  a Microsoft; el retorno entra por /auth/callback. Devuelve error solo si la INICIACION falla
 *  (p.ej. proveedor no configurado en el dashboard hasta el dia D). */
export async function signInWithAzure(supabase: Client): Promise<{ error: boolean }> {
  const redirectTo = `${window.location.origin}/auth/callback`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: { scopes: "openid email profile", redirectTo },
  });
  return { error: !!error };
}
