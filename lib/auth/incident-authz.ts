import type { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getMyMemberId } from "@/lib/incidents/queries";

// REGLA DE ORO (centralizada, §F). Un unico lugar define quien puede MUTAR un caso:
//  - Gestor (Gerente de Operaciones): tiene una capacidad de gestion amplia (incident.assign o
//    triage.manage) -> puede accionar CUALQUIER caso.
//  - Operador (y cualquier otro sin esa capacidad): SOLO puede accionar casos donde figura como
//    responsable asignado (assigned_member_id = su team_member, o assigned_user_id = su cuenta).
// Es backend-authoritative: toda mutacion sobre un caso ajeno se rechaza aqui, independientemente
// de lo que muestre la UI. Sumar roles futuros (Supervisor N2, Auditor) = ajustar MANAGE_ANY o el
// criterio de propiedad en este archivo, sin tocar cada accion.

type Ctx = NonNullable<Awaited<ReturnType<typeof getContext>>>;

const MANAGE_ANY = ["incident.assign", "triage.manage"];

/** true si el usuario actual puede MUTAR el caso `incidentId` (gestor amplio o responsable asignado). */
export async function canActOnIncident(ctx: Ctx, incidentId: string): Promise<boolean> {
  const access = await getAccessControl();
  if (access.isAdmin || MANAGE_ANY.some((c) => access.perms.includes(c))) return true;
  const memberId = await getMyMemberId(ctx.supabase, ctx.accountId);
  const { data } = await ctx.supabase
    .from("incident")
    .select("assigned_member_id, assigned_user_id")
    .eq("id", incidentId)
    .maybeSingle();
  if (!data) return false;
  return (!!memberId && data.assigned_member_id === memberId) || data.assigned_user_id === ctx.accountId;
}

/** Devuelve el codigo de error si NO puede accionar el caso; null si puede. Para usar en actions. */
export async function assertActOnIncident(ctx: Ctx, incidentId: string): Promise<string | null> {
  return (await canActOnIncident(ctx, incidentId)) ? null : "ERR_NOT_ASSIGNEE";
}

/** true si el usuario tiene la capacidad de gestion amplia (Gerente): asignar/triar/admin. */
export async function isIncidentManager(): Promise<boolean> {
  const access = await getAccessControl();
  return access.isAdmin || MANAGE_ANY.some((c) => access.perms.includes(c));
}
