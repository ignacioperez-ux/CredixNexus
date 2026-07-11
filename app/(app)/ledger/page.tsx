import { getContext } from "@/lib/auth/context";
import { getLedger } from "@/lib/ledger/queries";
import { LedgerView } from "@/components/ledger/ledger-view";

export default async function LedgerPage() {
  const ctx = await getContext();
  if (!ctx?.tenantId) return null;
  const data = await getLedger(ctx.supabase, ctx.tenantId);
  return <LedgerView data={data} />;
}
