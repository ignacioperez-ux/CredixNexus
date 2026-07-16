"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth/context";
import { getMyMemberId } from "@/lib/incidents/queries";
import { canManageSquadTasks } from "@/lib/squad-member/roles";

const STATES = ["todo", "doing", "blocked", "done"];

/** Mueve una tarea entre estados del kanban. Base: solo tareas PROPIAS. TL/PO: cualquier tarea de
 *  un squad donde tengan ese rol vigente (§1, capa de aplicacion). No duplica logica: misma
 *  project_task; el permiso se deriva del squad_role. */
export async function moveMyTask(taskId: string, status: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };
  if (!STATES.includes(status)) return { ok: false, error: "ERR_INVALID_FORMAT" };
  const memberId = await getMyMemberId(ctx.supabase, ctx.accountId);
  if (!memberId) return { ok: false, error: "ERR_PERMISSION_DENIED" };

  const { data: task } = await ctx.supabase
    .from("project_task")
    .select("assigned_member_id, project:project_id(squad_id)")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { ok: false, error: "not_found" };

  let allowed = task.assigned_member_id === memberId;
  if (!allowed) {
    // TL/PO del squad de origen puede mover tareas del squad.
    const proj = (Array.isArray(task.project) ? task.project[0] : task.project) as { squad_id: string | null } | null;
    if (proj?.squad_id) {
      const { data: mem } = await ctx.supabase
        .from("squad_member")
        .select("squad_role")
        .eq("member_id", memberId)
        .eq("squad_id", proj.squad_id)
        .eq("status", "active")
        .maybeSingle();
      allowed = !!mem && canManageSquadTasks(mem.squad_role as string);
    }
  }
  if (!allowed) return { ok: false, error: "ERR_PERMISSION_DENIED" };

  const patch: Record<string, unknown> = { status, completed_at: status === "done" ? new Date().toISOString() : null };
  const { error } = await ctx.supabase.from("project_task").update(patch).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mi-trabajo");
  revalidatePath("/mi-squad");
  return { ok: true };
}

/** Notifica al PO/TL (rol product_owner) que una tarea PROPIA esta bloqueada, via notify_role. */
export async function notifyBlocker(taskId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx?.tenantId) return { ok: false, error: "ERR_PERMISSION_DENIED" };
  const memberId = await getMyMemberId(ctx.supabase, ctx.accountId);
  if (!memberId) return { ok: false, error: "ERR_PERMISSION_DENIED" };
  const { data: task } = await ctx.supabase.from("project_task").select("title, assigned_member_id, project_id").eq("id", taskId).maybeSingle();
  if (!task || task.assigned_member_id !== memberId) return { ok: false, error: "ERR_PERMISSION_DENIED" };
  await ctx.supabase.rpc("notify_role", {
    p_role_code: "product_owner", p_type: "task_blocked",
    p_title: "Tarea bloqueada en un squad", p_body: `"${task.title}" esta bloqueada y requiere atencion.`,
    p_entity_type: "project_task", p_entity_id: taskId, p_link: task.project_id ? `/projects/${task.project_id}` : "/projects", p_severity: "warning",
  });
  return { ok: true };
}
