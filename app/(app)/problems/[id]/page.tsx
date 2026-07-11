import { notFound } from "next/navigation";
import { getContext, hasPermission } from "@/lib/auth/context";
import { getProblem, getLinkedIncidents, getLinkableIncidents } from "@/lib/problems/queries";
import { getLedgerForEntity } from "@/lib/incidents/queries";
import { getChangesForProblem } from "@/lib/changes/queries";
import { ProblemDetail } from "@/components/problems/problem-detail";

export default async function ProblemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;

  const problem = await getProblem(ctx.supabase, id);
  if (!problem) notFound();

  const [linked, linkable, ledger, canManage, changes, canManageChange] = await Promise.all([
    getLinkedIncidents(ctx.supabase, id),
    getLinkableIncidents(ctx.supabase, id),
    getLedgerForEntity(ctx.supabase, id),
    hasPermission(ctx.supabase, "problem.manage"),
    getChangesForProblem(ctx.supabase, id),
    hasPermission(ctx.supabase, "change.manage"),
  ]);

  return (
    <ProblemDetail
      problem={problem as never}
      linked={linked}
      linkable={linkable}
      ledger={ledger as never}
      canManage={canManage}
      changes={changes}
      canManageChange={canManageChange}
    />
  );
}
