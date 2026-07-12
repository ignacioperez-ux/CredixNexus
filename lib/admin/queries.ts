import type { SupabaseClient } from "@supabase/supabase-js";

// Hub de Administracion. Las funciones SECURITY DEFINER validan user.manage y aislan por tenant.

export type AdminOverview = { users_active: number; users_total: number; roles: number; incidents: number; projects: number; audit_events: number };
export type AdminUser = { account_id: string; full_name: string; email: string; status: string; roles: string[] };
export type AdminRole = { code: string; name: string };

export async function getAdminOverview(supabase: SupabaseClient): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) throw new Error(error.message);
  return data as AdminOverview;
}

export async function listAdminUsers(supabase: SupabaseClient): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUser[];
}

export async function listAdminRoles(supabase: SupabaseClient): Promise<AdminRole[]> {
  const { data, error } = await supabase.rpc("admin_list_roles");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminRole[];
}
