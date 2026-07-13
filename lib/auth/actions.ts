"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Cierre de sesion server-side: al ejecutarse dentro de una server action, el cliente de
// Supabase SI puede escribir cookies, por lo que signOut() elimina de verdad las cookies de
// sesion (el signOut del cliente no siempre las limpia en SSR y permitia re-entrar). scope
// "global" revoca la sesion en el backend, no solo localmente.
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
