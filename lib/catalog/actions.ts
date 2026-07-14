"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { validateFormData, hasErrors, summarizeFormData, validateItem, validateCategory, type FormField, type ItemInput, type CategoryInput } from "@/lib/catalog/validation";

export type CatalogResult = { ok: boolean; error?: string; id?: string; requestId?: string; fieldErrors?: Record<string, string> };

async function guard(perm: string) {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, perm))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

/** Solicita un item del catalogo: valida el formulario dinamico, crea el caso ANCLA
 *  (incidente, case_type='Request'), la solicitud, y dispara el workflow del item si tiene. */
export async function submitRequest(itemId: string, formData: Record<string, unknown>): Promise<CatalogResult> {
  const { ctx, err } = await guard("service_catalog.request");
  if (!ctx) return { ok: false, error: err! };

  const { data: item } = await ctx.supabase
    .from("service_item")
    .select("id, code, name, category, form_schema, sla_hours, delivery_area_id, workflow_definition_id, default_impact, default_urgency, status")
    .eq("id", itemId).maybeSingle();
  if (!item || item.status !== "active") return { ok: false, error: ErrorCode.INVALID_REFERENCE };

  const schema = (item.form_schema as FormField[]) ?? [];
  const fieldErrors = validateFormData(schema, formData);
  if (hasErrors(fieldErrors)) return { ok: false, error: ErrorCode.FORMAT, fieldErrors };

  const description = `Solicitud de servicio: ${item.name}\n\n${summarizeFormData(schema, formData)}`;

  // Atomico (§11): crea el incidente ancla y la solicitud en una sola transaccion.
  const { data: created, error: rpcErr } = await ctx.supabase.rpc("create_service_request", {
    p_item_id: itemId,
    p_form_data: formData,
    p_description: description,
  });
  if (rpcErr) {
    if (rpcErr.message.includes("item_not_found")) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
    return { ok: false, error: rpcErr.message };
  }
  const result = created as { incident_id: string; request_id: string };
  const incidentId = result.incident_id;
  const requestId = result.request_id;

  // Disparar workflow del item (si define uno). No bloquea la solicitud si falla.
  if (item.workflow_definition_id) {
    const { data: wf } = await ctx.supabase.rpc("start_workflow", {
      p_definition_id: item.workflow_definition_id,
      p_entity_type: "request",
      p_entity_id: incidentId,
      p_title: `Solicitud: ${item.name}`,
    });
    if (wf) await ctx.supabase.from("service_request").update({ workflow_instance_id: wf as string }).eq("id", requestId);
  }

  revalidatePath("/service-catalog");
  return { ok: true, id: incidentId, requestId };
}

/** Cumplir la solicitud: marca fulfilled y resuelve el caso ancla (habilita CSAT). */
export async function fulfillRequest(id: string): Promise<CatalogResult> {
  const { ctx, err } = await guard("service_catalog.manage");
  if (!ctx) return { ok: false, error: err! };
  const { data: req } = await ctx.supabase.from("service_request").select("incident_id, status").eq("id", id).maybeSingle();
  if (!req) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  if (req.status !== "open") return { ok: false, error: ErrorCode.STATE };
  const { error } = await ctx.supabase.from("service_request").update({ status: "fulfilled", fulfilled_at: new Date().toISOString(), updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await ctx.supabase.from("incident").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", req.incident_id);
  revalidatePath("/service-catalog");
  revalidatePath(`/service-catalog/requests/${id}`);
  return { ok: true, id };
}

export async function cancelRequest(id: string): Promise<CatalogResult> {
  const { ctx, err } = await guard("service_catalog.manage");
  if (!ctx) return { ok: false, error: err! };
  const { data: req } = await ctx.supabase.from("service_request").select("incident_id, status").eq("id", id).maybeSingle();
  if (!req) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  if (req.status !== "open") return { ok: false, error: ErrorCode.STATE };
  const { error } = await ctx.supabase.from("service_request").update({ status: "cancelled", updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await ctx.supabase.from("incident").update({ status: "cancelled" }).eq("id", req.incident_id);
  revalidatePath("/service-catalog");
  revalidatePath(`/service-catalog/requests/${id}`);
  return { ok: true, id };
}

// ---- Admin de items (master data, §10.5) ----
export async function createItem(input: ItemInput & { description?: string }): Promise<CatalogResult> {
  const { ctx, err } = await guard("service_catalog.manage");
  if (!ctx) return { ok: false, error: err! };
  const v = validateItem(input);
  if (v) return { ok: false, error: v };
  // La categoria viene del maestro (categoryId); se resuelve su code para compat con `category`.
  const { data: cat } = await ctx.supabase.from("service_category").select("code").eq("id", input.categoryId).maybeSingle();
  if (!cat) return { ok: false, error: ErrorCode.INVALID_REFERENCE };
  const { data, error } = await ctx.supabase
    .from("service_item")
    .insert({
      tenant_id: ctx.tenantId, code: input.code.trim(), name: input.name.trim(), description: input.description?.trim() || null,
      category: cat.code as string, category_id: input.categoryId, form_schema: input.formSchema, sla_hours: input.slaHours, created_by: ctx.accountId,
    })
    .select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath("/service-catalog");
  return { ok: true, id: data.id as string };
}

// ---- Admin de categorias (maestro con i18n, §10.5) ----
export async function createCategory(input: CategoryInput): Promise<CatalogResult> {
  const { ctx, err } = await guard("service_catalog.manage");
  if (!ctx) return { ok: false, error: err! };
  const v = validateCategory(input);
  if (v) return { ok: false, error: v };
  const { data, error } = await ctx.supabase
    .from("service_category")
    .insert({ tenant_id: ctx.tenantId, code: input.code.trim().toLowerCase(), name_es: input.nameEs.trim(), name_en: input.nameEn.trim(), created_by: ctx.accountId })
    .select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };
  revalidatePath("/service-catalog");
  return { ok: true, id: data.id as string };
}

export async function setCategoryStatus(id: string, active: boolean): Promise<CatalogResult> {
  const { ctx, err } = await guard("service_catalog.manage");
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("service_category").update({ status: active ? "active" : "inactive", updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/service-catalog");
  return { ok: true, id };
}

export async function setItemStatus(id: string, active: boolean): Promise<CatalogResult> {
  const { ctx, err } = await guard("service_catalog.manage");
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("service_item").update({ status: active ? "active" : "inactive", updated_by: ctx.accountId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/service-catalog");
  return { ok: true, id };
}
