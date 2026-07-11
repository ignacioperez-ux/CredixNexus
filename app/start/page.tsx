import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { defaultHome } from "@/lib/nav/access";

// Resuelve el "home por rol": al ingresar, redirige al usuario a la pantalla mas relevante
// segun su acceso real (agente -> workspace, evolucion/squad -> proyectos, usuario -> portal,
// admin -> dashboard). Sin shell (evita el flash del layout).
export default async function StartPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: perms }, { data: roles }] = await Promise.all([
    supabase.rpc("my_permissions"),
    supabase.rpc("my_roles"),
  ]);
  const roleList = (roles as string[] | null) ?? [];
  const isAdmin = roleList.includes("system_admin") || roleList.includes("tenant_admin");
  redirect(defaultHome((perms as string[] | null) ?? [], isAdmin));
}
