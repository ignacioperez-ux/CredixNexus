import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NoAccessCard } from "./no-access-card";

// Pantalla para una identidad FEDERADA autenticada pero SIN cuenta pre-aprovisionada.
// Vive en el grupo (auth) (sin guard de app). Inerte con el flag apagado.
export default async function NoAccessPage() {
  if (process.env.NEXT_PUBLIC_SSO_ENABLED !== "true") redirect("/login");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Si ya esta aprovisionado, esta pantalla no corresponde.
  const { data: acct } = await supabase
    .from("user_account").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (acct) redirect("/start");

  const email = user.email ?? "";
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const fullName = meta.full_name ?? meta.name ?? "";

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-2xl)", padding: 32 }}>
        <NoAccessCard email={email} fullName={fullName} />
      </div>
    </main>
  );
}
