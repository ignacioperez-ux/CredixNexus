import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getChange } from "@/lib/changes/queries";
import { getLedgerForEntity } from "@/lib/incidents/queries";
import { ChangeDetail } from "@/components/changes/change-detail";

export default async function ChangeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;

  const change = await getChange(ctx.supabase, id);
  if (!change) notFound();

  const [ledger, access] = await Promise.all([
    getLedgerForEntity(ctx.supabase, id),
    getAccessControl(),
  ]);
  const canManage = access.isAdmin || access.perms.includes("change.manage");
  const canApprove = access.isAdmin || access.perms.includes("change.approve");

  return <ChangeDetail change={change as never} ledger={ledger as never} canManage={canManage} canApprove={canApprove} />;
}
