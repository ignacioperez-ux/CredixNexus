"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { validateVendor } from "@/lib/vendors/validation";

export type VendorResult = { ok: boolean; error?: string; id?: string };

const PERM = "vendor.manage";
const orNull = (v?: string | null) => (v && v.trim().length > 0 ? v.trim() : null);

export type VendorInput = {
  code: string;
  name: string;
  legalName?: string;
  category: string;
  criticality: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  contractNumber?: string;
  contractStart?: string | null;
  contractEnd?: string | null;
  slaTerms?: string;
  notes?: string;
};

async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

function toRow(i: VendorInput) {
  return {
    code: i.code.trim(),
    name: i.name.trim(),
    legal_name: orNull(i.legalName),
    category: i.category,
    criticality: i.criticality,
    contact_name: orNull(i.contactName),
    contact_email: orNull(i.contactEmail),
    contact_phone: orNull(i.contactPhone),
    website: orNull(i.website),
    contract_number: orNull(i.contractNumber),
    contract_start: orNull(i.contractStart),
    contract_end: orNull(i.contractEnd),
    sla_terms: orNull(i.slaTerms),
    notes: orNull(i.notes),
  };
}

export async function createVendor(input: VendorInput): Promise<VendorResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateVendor(input);
  if (v) return { ok: false, error: v };
  const { data, error } = await ctx.supabase.from("vendor").insert({ tenant_id: ctx.tenantId, created_by: ctx.accountId, ...toRow(input) }).select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath("/vendors");
  return { ok: true, id: data.id as string };
}

export async function updateVendor(id: string, input: VendorInput): Promise<VendorResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const v = validateVendor(input);
  if (v) return { ok: false, error: v };
  const { error } = await ctx.supabase.from("vendor").update({ ...toRow(input), updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath(`/vendors/${id}`);
  revalidatePath("/vendors");
  return { ok: true, id };
}

/** Desactivacion logica (soft delete): el proveedor puede estar referenciado por CIs. */
export async function deactivateVendor(id: string): Promise<VendorResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("vendor").update({ status: "inactive", updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/vendors/${id}`);
  revalidatePath("/vendors");
  return { ok: true, id };
}

export async function reactivateVendor(id: string): Promise<VendorResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("vendor").update({ status: "active", updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/vendors/${id}`);
  revalidatePath("/vendors");
  return { ok: true, id };
}
