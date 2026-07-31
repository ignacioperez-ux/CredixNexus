"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";

// Administracion de dominios permitidos para SSO (JIT provisioning). Es config sensible de
// SEGURIDAD (controla quien puede entrar por Entra ID) -> gateada a admin (system_admin /
// tenant_admin). La tabla sso_allowed_domain (0130) tiene RLS por tenant y auditoria al
// ledger via trigger; estas actions solo validan + escriben. Ver docs/auth/SSO_ACTIVE_DIRECTORY_PLAN.md.

export type SsoDomainRow = {
  id: string;
  domain: string;
  status: string;
  notes: string | null;
  default_role_id: string;
  role: { code: string; name: string } | { code: string; name: string }[] | null;
};

export type SsoRoleOption = { id: string; code: string; name: string };
export type SsoResult = { ok: boolean; error?: string; errorField?: string; id?: string };

// Mismo formato que el CHECK chk_sso_domain_format del esquema (minusculas, sin @, con punto).
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

async function requireAdmin() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null as null, denied: true };
  const access = await getAccessControl();
  if (!access.isAdmin) return { ctx: null as null, denied: true };
  return { ctx, denied: false };
}

/** Lista de dominios del tenant (RLS aplica). Incluye el rol para mostrar nombre descriptivo (§10.3). */
export async function listSsoDomains(): Promise<SsoDomainRow[]> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return [];
  const { data, error } = await ctx.supabase
    .from("sso_allowed_domain")
    .select("id, domain, status, notes, default_role_id, role:default_role_id(code, name)")
    .order("domain", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SsoDomainRow[];
}

/** Roles asignables como default del JIT: globales (tenant_id null) + del tenant. Desde la BD (§11). */
export async function listAssignableRoles(): Promise<SsoRoleOption[]> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return [];
  const { data, error } = await ctx.supabase
    .from("role")
    .select("id, code, name, tenant_id, status")
    .eq("status", "active")
    .or(`tenant_id.is.null,tenant_id.eq.${ctx.tenantId}`)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as SsoRoleOption[]).map((r) => ({ id: r.id, code: r.code, name: r.name }));
}

/** Alta/edicion de un dominio permitido. Valida formato + rol + duplicado. */
export async function upsertSsoDomain(
  id: string | null,
  input: { domain: string; default_role_id: string; notes?: string },
): Promise<SsoResult> {
  const { ctx, denied } = await requireAdmin();
  if (denied || !ctx) return { ok: false, error: "sso.admin.err.permission" };

  const domain = (input.domain ?? "").trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) return { ok: false, error: "sso.admin.err.domain_format", errorField: "domain" };

  const roleId = (input.default_role_id ?? "").trim();
  if (!roleId) return { ok: false, error: "sso.admin.err.role_required", errorField: "default_role_id" };

  // El rol debe existir y ser global o del tenant (partner_user es global).
  const { data: role } = await ctx.supabase
    .from("role")
    .select("id")
    .eq("id", roleId)
    .or(`tenant_id.is.null,tenant_id.eq.${ctx.tenantId}`)
    .limit(1);
  if (!role || role.length === 0) return { ok: false, error: "sso.admin.err.role_required", errorField: "default_role_id" };

  // Duplicado (dominio es unico global). Mensaje claro (§10.6).
  let dupQ = ctx.supabase.from("sso_allowed_domain").select("id").eq("domain", domain);
  if (id) dupQ = dupQ.neq("id", id);
  const { data: dup } = await dupQ.limit(1);
  if (dup && dup.length > 0) return { ok: false, error: "sso.admin.err.duplicate", errorField: "domain" };

  const notes = (input.notes ?? "").trim() || null;

  if (id) {
    const { error } = await ctx.supabase
      .from("sso_allowed_domain")
      .update({ domain, default_role_id: roleId, notes })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/sso-domains");
    return { ok: true, id };
  }
  const { data, error } = await ctx.supabase
    .from("sso_allowed_domain")
    .insert({ domain, default_role_id: roleId, notes, tenant_id: ctx.tenantId })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/sso-domains");
  return { ok: true, id: data.id as string };
}

/** Soft delete / reactivacion (nunca borrado fisico, §10.5). */
export async function setSsoDomainStatus(id: string, active: boolean): Promise<SsoResult> {
  const { ctx, denied } = await requireAdmin();
  if (denied || !ctx) return { ok: false, error: "sso.admin.err.permission" };
  const { error } = await ctx.supabase
    .from("sso_allowed_domain")
    .update({ status: active ? "active" : "inactive" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/sso-domains");
  return { ok: true, id };
}
