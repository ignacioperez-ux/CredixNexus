import { redirect } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { listSsoDomains, listAssignableRoles } from "@/lib/auth/sso-domains";
import { SsoDomainsAdmin } from "@/components/admin/sso-domains-admin";

// Admin de dominios SSO permitidos (JIT provisioning). Config sensible de seguridad:
// gateada a admin (system_admin / tenant_admin). No cambia rutas/permisos existentes.
export default async function SsoDomainsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const access = await getAccessControl();
  if (!access.isAdmin) redirect("/unauthorized");

  const [domains, roles] = await Promise.all([listSsoDomains(), listAssignableRoles()]);
  return <SsoDomainsAdmin domains={domains} roles={roles} />;
}
