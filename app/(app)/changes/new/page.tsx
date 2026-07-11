import { redirect } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getChangeFormOptions } from "@/lib/changes/queries";
import { ChangeForm } from "@/components/changes/change-form";

export default async function NewChangePage({ searchParams }: { searchParams: Promise<{ incident?: string; problem?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx) return null;
  if (!(await hasPermission(ctx.supabase, "change.manage"))) redirect("/changes");
  const options = await getChangeFormOptions(ctx.supabase);
  return (
    <ChangeForm
      options={options}
      initial={{
        title: "", changeType: "normal", riskLevel: "medium",
        relatedIncidentId: sp.incident ?? null,
        relatedProblemId: sp.problem ?? null,
      }}
    />
  );
}
