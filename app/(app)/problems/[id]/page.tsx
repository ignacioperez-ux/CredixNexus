import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
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

  const [linked, linkable, ledger, changes, access] = await Promise.all([
    getLinkedIncidents(ctx.supabase, id),
    getLinkableIncidents(ctx.supabase, id),
    getLedgerForEntity(ctx.supabase, id),
    getChangesForProblem(ctx.supabase, id),
    getAccessControl(),
  ]);
  const canManage = access.isAdmin || access.perms.includes("problem.manage");
  const canManageChange = access.isAdmin || access.perms.includes("change.manage");

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
