import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveHome } from "@/lib/nav/role-ux";

// Resuelve el "home por rol" (FASE 2): usa el landing declarado en ROLE_UX para el rol
// (Ops -> dashboard/Command Center, Evolucion -> dashboard, Squad -> proyectos, Operador ->
// workspace, usuario final -> portal), verificado contra permisos; si no aplica, cae al
// heuristico. Sin shell (evita el flash del layout).
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
  redirect(resolveHome(roleList, (perms as string[] | null) ?? [], isAdmin));
}
