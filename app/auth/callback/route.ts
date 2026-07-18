import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Retorno del login federado (OIDC/PKCE) de Azure/Entra ID. Intercambia el code por sesion y
// enruta segun aprovisionamiento:
//   - vinculado (existe user_account por auth_user_id) -> /start
//   - NO vinculado (identidad federada sin cuenta pre-aprovisionada) -> /no-access
// Con el flag apagado la ruta es INERTE (vuelve a /login): la app es identica a hoy.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  if (process.env.NEXT_PUBLIC_SSO_ENABLED !== "true") {
    return NextResponse.redirect(`${origin}/login`);
  }

  const oauthError = searchParams.get("error");
  if (oauthError) {
    // Cancelacion en Microsoft u otro error devuelto por el proveedor.
    return NextResponse.redirect(`${origin}/login?sso_error=cancelled`);
  }

  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?sso_error=exchange`);

  // El trigger handle_new_user() ya intento vincular por email al crearse el auth.users.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: acct } = await supabase
      .from("user_account")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!acct) return NextResponse.redirect(`${origin}/no-access`);
  }

  return NextResponse.redirect(`${origin}/start`);
}
