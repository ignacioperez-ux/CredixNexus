import { notFound, redirect } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getProblem, getProblemFormOptions } from "@/lib/problems/queries";
import { ProblemForm } from "@/components/problems/problem-form";

export default async function EditProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;
  if (!(await hasPermission(ctx.supabase, "problem.manage"))) redirect(`/problems/${id}`);

  const [problem, options] = await Promise.all([
    getProblem(ctx.supabase, id),
    getProblemFormOptions(ctx.supabase),
  ]);
  if (!problem) notFound();

  const p = problem as Record<string, unknown>;
  return (
    <ProblemForm
      options={options}
      initial={{
        id,
        title: (p.title as string) ?? "",
        description: (p.description as string) ?? "",
        priority: (p.priority as string) ?? "medium",
        category: (p.category as string) ?? "",
        rootCauseSummary: (p.root_cause_summary as string) ?? "",
        workaround: (p.workaround as string) ?? "",
        knownError: (p.known_error as boolean) ?? false,
        affectedServiceId: (p.affected_service_id as string) ?? "",
        affectedCiId: (p.affected_ci_id as string) ?? "",
      }}
    />
  );
}
