"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode, email as emailValidator } from "@/lib/validation";

export type AreaResult = { ok: boolean; error?: string; id?: string };

const orNull = (v?: string | null) => (v && v.trim().length > 0 ? v.trim() : null);

export type AreaInput = { description?: string; leadName?: string; leadEmail?: string; deputyName?: string; deputyEmail?: string };

export async function updateDeliveryArea(id: string, input: AreaInput): Promise<AreaResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await hasPermission(ctx.supabase, "area.manage"))) return { ok: false, error: ErrorCode.PERMISSION };

  for (const em of [input.leadEmail, input.deputyEmail]) {
    if (em && em.trim().length > 0) { const e = emailValidator(em.trim()); if (e) return { ok: false, error: e }; }
  }

  const { error } = await ctx.supabase
    .from("delivery_area")
    .update({
      description: orNull(input.description),
      lead_name: orNull(input.leadName),
      lead_email: orNull(input.leadEmail),
      deputy_name: orNull(input.deputyName),
      deputy_email: orNull(input.deputyEmail),
      updated_by: ctx.accountId,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/delivery-areas");
  return { ok: true, id };
}
