"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { validateSquadMember, validateSquad, type SquadMemberInput, type SquadInput } from "@/lib/squads/validation";

export type SquadResult = { ok: boolean; error?: string; id?: string };

const PERM = "squad.manage";

async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

/** Crea un squad (dato maestro). Codigo unico por tenant; validado en BD, servicio y UI. */
export async function createSquad(input: SquadInput): Promise<SquadResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateSquad(input);
  if (v) return { ok: false, error: v };

  const code = input.code.trim().toUpperCase();
  const { data: dup } = await ctx.supabase
    .from("squad").select("id").eq("tenant_id", ctx.tenantId).eq("code", code).maybeSingle();
  if (dup) return { ok: false, error: ErrorCode.DUPLICATE };

  const { data, error } = await ctx.supabase
    .from("squad")
    .insert({
      tenant_id: ctx.tenantId,
      code,
      name: input.name.trim(),
      business_unit_id: input.businessUnitId && input.businessUnitId.length > 0 ? input.businessUnitId : null,
      is_transversal: input.isTransversal,
      capacity_points: input.capacityPoints,
      created_by: ctx.accountId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath("/squads");
  return { ok: true, id: data.id as string };
}

export async function addSquadMember(squadId: string, input: SquadMemberInput): Promise<SquadResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateSquadMember(input);
  if (v) return { ok: false, error: v };
  const { data, error } = await ctx.supabase
    .from("squad_member")
    .insert({ tenant_id: ctx.tenantId, squad_id: squadId, member_id: input.memberId, squad_role: input.squadRole, allocation_pct: input.allocationPct, created_by: ctx.accountId })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath(`/squads/${squadId}`);
  revalidatePath("/squads");
  return { ok: true, id: data.id as string };
}

export async function updateSquadMember(memberRowId: string, squadId: string, squadRole: string, allocationPct: number): Promise<SquadResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateSquadMember({ memberId: "x", squadRole, allocationPct });
  if (v) return { ok: false, error: v };
  const { error } = await ctx.supabase
    .from("squad_member")
    .update({ squad_role: squadRole, allocation_pct: allocationPct, updated_by: ctx.accountId })
    .eq("id", memberRowId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/squads/${squadId}`);
  return { ok: true, id: memberRowId };
}

/** Baja del roster (soft-delete: la persona pudo participar en trabajo referenciado). */
export async function removeSquadMember(memberRowId: string, squadId: string): Promise<SquadResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("squad_member").update({ status: "inactive", updated_by: ctx.accountId }).eq("id", memberRowId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/squads/${squadId}`);
  revalidatePath("/squads");
  return { ok: true, id: memberRowId };
}
