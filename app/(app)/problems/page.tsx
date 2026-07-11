import { getContext, hasPermission } from "@/lib/auth/context";
import { listProblems } from "@/lib/problems/queries";
import { ProblemList } from "@/components/problems/problem-list";

export default async function ProblemsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [data, canManage] = await Promise.all([
    listProblems(ctx.supabase),
    hasPermission(ctx.supabase, "problem.manage"),
  ]);
  return <ProblemList data={data} canManage={canManage} />;
}
