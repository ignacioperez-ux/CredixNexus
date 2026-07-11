import { redirect } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getProblemFormOptions } from "@/lib/problems/queries";
import { ProblemForm } from "@/components/problems/problem-form";

export default async function NewProblemPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  if (!(await hasPermission(ctx.supabase, "problem.manage"))) redirect("/problems");
  const options = await getProblemFormOptions(ctx.supabase);
  return <ProblemForm options={options} />;
}
