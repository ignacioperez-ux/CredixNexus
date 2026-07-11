import { notFound, redirect } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getChange, getChangeFormOptions } from "@/lib/changes/queries";
import { ChangeForm } from "@/components/changes/change-form";

export default async function EditChangePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  if (!(await hasPermission(ctx.supabase, "change.manage"))) redirect(`/changes/${id}`);

  const [change, options] = await Promise.all([
    getChange(ctx.supabase, id),
    getChangeFormOptions(ctx.supabase),
  ]);
  if (!change) notFound();
  const c = change as Record<string, unknown>;

  return (
    <ChangeForm
      options={options}
      initial={{
        id,
        title: (c.title as string) ?? "",
        description: (c.description as string) ?? "",
        changeType: (c.change_type as string) ?? "normal",
        riskLevel: (c.risk_level as string) ?? "medium",
        justification: (c.justification as string) ?? "",
        implementationPlan: (c.implementation_plan as string) ?? "",
        rollbackPlan: (c.rollback_plan as string) ?? "",
        affectedServiceId: (c.affected_service_id as string) ?? "",
        affectedCiId: (c.affected_ci_id as string) ?? "",
        relatedIncidentId: (c.related_incident_id as string) ?? null,
        relatedProblemId: (c.related_problem_id as string) ?? null,
        plannedStart: toLocal(c.planned_start as string | null),
        plannedEnd: toLocal(c.planned_end as string | null),
      }}
    />
  );
}

function toLocal(v: string | null): string {
  if (!v) return "";
  return new Date(v).toISOString().slice(0, 16);
}
