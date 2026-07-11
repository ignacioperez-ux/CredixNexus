"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { getCatalog, type Field } from "./registry";

const PERM = "masterdata.manage";

export type MdResult = { ok: boolean; error?: string; errorField?: string; id?: string };

const CODE_RE = /^[A-Z0-9_\-]{2,80}$/;

function validateField(f: Field, raw: unknown): { value: unknown; error?: string } {
  // bool
  if (f.type === "bool") return { value: raw === true || raw === "true" };
  // number
  if (f.type === "number") {
    if (raw === "" || raw == null) return f.required ? { value: null, error: ErrorCode.REQUIRED } : { value: null };
    const n = Number(raw);
    if (Number.isNaN(n)) return { value: null, error: ErrorCode.FORMAT };
    if (f.min != null && n < f.min) return { value: n, error: ErrorCode.FORMAT };
    if (f.max != null && n > f.max) return { value: n, error: ErrorCode.FORMAT };
    return { value: n };
  }
  // fk: valor uuid (existencia referencial se valida aparte, contra la BD)
  if (f.type === "fk") {
    const fv = typeof raw === "string" ? raw.trim() : "";
    if (!fv) return f.required ? { value: null, error: ErrorCode.REQUIRED } : { value: null };
    return { value: fv };
  }
  // text / code / enum
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return f.required ? { value: null, error: ErrorCode.REQUIRED } : { value: null };
  if (f.type === "code" && !CODE_RE.test(s)) return { value: s, error: ErrorCode.FORMAT };
  if (f.type === "enum" && f.options && !f.options.includes(s)) return { value: s, error: ErrorCode.INVALID_REFERENCE };
  if (f.min != null && s.length < f.min) return { value: s, error: ErrorCode.MIN_LENGTH };
  if (f.max != null && s.length > f.max) return { value: s, error: ErrorCode.FORMAT };
  return { value: s };
}

/** Alta/modificación de un registro de catálogo (whitelist por registry). */
export async function upsertRecord(
  catalogKey: string,
  id: string | null,
  input: Record<string, unknown>,
): Promise<MdResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ok: false, error: ErrorCode.PERMISSION };
  const catalog = getCatalog(catalogKey);
  if (!catalog) return { ok: false, error: ErrorCode.INVALID_REFERENCE };

  // Validación backend por campo (§10.7)
  const values: Record<string, unknown> = {};
  for (const f of catalog.fields) {
    const { value, error } = validateField(f, input[f.name]);
    if (error) return { ok: false, error, errorField: f.name };
    values[f.name] = value;
  }

  // Integridad referencial: cada FK debe existir y pertenecer al tenant (§10.3)
  for (const f of catalog.fields.filter((x) => x.type === "fk" && x.fkTable)) {
    const v = values[f.name];
    if (v) {
      const { data: ref } = await ctx.supabase.from(f.fkTable as string).select("id").eq("id", v).eq("tenant_id", ctx.tenantId).limit(1);
      if (!ref || ref.length === 0) return { ok: false, error: ErrorCode.INVALID_REFERENCE, errorField: f.name };
    }
  }

  // Control de duplicados por code (§10.4) — capa servicio
  const code = values["code"] as string | undefined;
  if (code) {
    let dupQ = ctx.supabase.from(catalog.table).select("id").eq("tenant_id", ctx.tenantId).eq("code", code);
    if (id) dupQ = dupQ.neq("id", id);
    const { data: dup } = await dupQ.limit(1);
    if (dup && dup.length > 0) return { ok: false, error: ErrorCode.DUPLICATE, errorField: "code" };
  }

  if (id) {
    const { error } = await ctx.supabase.from(catalog.table).update(values).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/catalog/${catalogKey}`);
    return { ok: true, id };
  } else {
    const { data, error } = await ctx.supabase
      .from(catalog.table)
      .insert({ ...values, tenant_id: ctx.tenantId })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/catalog/${catalogKey}`);
    return { ok: true, id: data.id as string };
  }
}

/** Soft delete / reactivación (§10.5). Nunca borrado físico. */
export async function setRecordStatus(catalogKey: string, id: string, status: "active" | "inactive" | "archived"): Promise<MdResult> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: ErrorCode.PERMISSION };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ok: false, error: ErrorCode.PERMISSION };
  const catalog = getCatalog(catalogKey);
  if (!catalog) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const { error } = await ctx.supabase.from(catalog.table).update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/catalog/${catalogKey}`);
  return { ok: true, id };
}
