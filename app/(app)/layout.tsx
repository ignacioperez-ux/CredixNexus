import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Header } from "@/components/app-shell/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Perfil del usuario (RLS: solo su propio tenant). Aprovisionado por trigger handle_new_user.
  const { data: account } = await supabase
    .from("user_account")
    .select("full_name, tenant:tenant_id (name)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const userName = account?.full_name ?? user.email ?? "Usuario";
  const tenantRel = account?.tenant as { name?: string } | { name?: string }[] | null | undefined;
  const tenantName =
    (Array.isArray(tenantRel) ? tenantRel[0]?.name : tenantRel?.name) ?? "Credix Core";

  // Navegacion por rol: permisos + roles del usuario para filtrar el menu (bypass admin).
  const [{ data: perms }, { data: roles }] = await Promise.all([
    supabase.rpc("my_permissions"),
    supabase.rpc("my_roles"),
  ]);
  const roleList = (roles as string[] | null) ?? [];
  const isAdmin = roleList.includes("system_admin") || roleList.includes("tenant_admin");

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar userName={userName} userRole={tenantName} perms={(perms as string[] | null) ?? []} isAdmin={isAdmin} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header />
        <main style={{ flex: 1, overflowY: "auto", background: "var(--bg)", padding: "26px 30px 40px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
