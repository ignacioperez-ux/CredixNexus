"use server";

import { revalidatePath } from "next/cache";
import { getContext, hasPermission } from "@/lib/auth/context";
import { ErrorCode } from "@/lib/validation";
import { validateDependencyInput, type DependencyInput } from "@/lib/dependencies/validation";
import { getDependencyEdges } from "@/lib/dependencies/queries";
import { wouldCreateCycle } from "@/lib/dependencies/graph";

export type DependencyResult = { ok: boolean; error?: string; id?: string };

const PERM = "cmdb.manage";

async function guard() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ctx: null, err: ErrorCode.PERMISSION as string };
  if (!(await hasPermission(ctx.supabase, PERM))) return { ctx: null, err: ErrorCode.PERMISSION as string };
  return { ctx, err: null as string | null };
}

/** Declara una dependencia service -> service (dato maestro). Valida self, tipo, duplicado
 *  (3 capas) y CICLO contra las aristas existentes antes de insertar. */
export async function addDependency(input: DependencyInput): Promise<DependencyResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };

  const v = validateDependencyInput(input);
  if (v) return { ok: false, error: v };

  // Verificar que ambos servicios existen en el tenant (RLS acota).
  const { data: svcs } = await ctx.supabase.from("service").select("id").in("id", [input.serviceId, input.dependsOnId]);
  if ((svcs ?? []).length !== 2) return { ok: false, error: ErrorCode.INVALID_REFERENCE };

  // Chequeo de ciclo sobre la topologia actual.
  const edges = await getDependencyEdges(ctx.supabase);
  if (wouldCreateCycle(edges, input.serviceId, input.dependsOnId)) return { ok: false, error: ErrorCode.STATE };

  const { data, error } = await ctx.supabase
    .from("service_dependency")
    .insert({
      tenant_id: ctx.tenantId,
      service_id: input.serviceId,
      depends_on_service_id: input.dependsOnId,
      dependency_type: input.dependencyType,
      criticality: input.criticality,
      description: input.description?.trim() || null,
      created_by: ctx.accountId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? ErrorCode.DUPLICATE : error.message };

  revalidatePath("/dependencies");
  return { ok: true, id: data.id as string };
}

/** Elimina una arista de dependencia (auditado por trigger de delete). */
export async function removeDependency(id: string): Promise<DependencyResult> {
  const { ctx, err } = await guard();
  if (!ctx) return { ok: false, error: err! };
  const { error } = await ctx.supabase.from("service_dependency").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dependencies");
  return { ok: true, id };
}
