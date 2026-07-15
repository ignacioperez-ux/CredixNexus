import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Header } from "@/components/app-shell/header";
import { CommandMenu } from "@/components/app-shell/command-menu";
import { HelpFab } from "@/components/app-shell/help-fab";
import { NavHistoryProvider } from "@/components/app-shell/nav-history-provider";
import { PageBack } from "@/components/app-shell/page-back";
import { canSeeNav, requiredPermForPath } from "@/lib/nav/access";
import { getSessionUser, getSessionAccount, getAccessControl, tenantNameOf } from "@/lib/auth/session";
import { getContext } from "@/lib/auth/context";
import { listNotifications } from "@/lib/notifications/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Perfil + control de acceso en paralelo, reutilizando la sesion cacheada por request
  // (session.ts): las paginas hijas comparten estas mismas resoluciones, sin repetir viajes.
  const [account, access, ctx] = await Promise.all([getSessionAccount(), getAccessControl(), getContext()]);
  const notifications = ctx ? await listNotifications(ctx.supabase) : { items: [], unread: 0 };

  const userName = account?.full_name ?? user.email ?? "Usuario";
  const tenantName = tenantNameOf(account);
  const { perms: permList, roles: roleList, isAdmin } = access;

  // Guard de ruta por permiso: si la ruta requiere un permiso que el usuario no tiene, /unauthorized.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const required = requiredPermForPath(pathname);
  if (required && !canSeeNav(required, permList, isAdmin)) {
    redirect("/unauthorized");
  }

  return (
    <NavHistoryProvider>
      <div style={{ display: "flex", height: "100dvh", overflow: "hidden" }}>
        <Sidebar userName={userName} userRole={tenantName} perms={permList} isAdmin={isAdmin} roles={roleList} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          <Header roles={roleList} perms={permList} isAdmin={isAdmin} notifications={notifications} />
          <main style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "var(--bg)", padding: "26px 30px 40px" }}>
            <PageBack />
            {children}
          </main>
        </div>
        <CommandMenu perms={permList} isAdmin={isAdmin} />
        <HelpFab />
      </div>
    </NavHistoryProvider>
  );
}
