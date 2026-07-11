import { getContext } from "@/lib/auth/context";
import { listFraud, listDisputes } from "@/lib/fraud/queries";
import { FraudDisputes } from "@/components/fraud/fraud-disputes";

export default async function FraudDisputesPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [fraud, disputes] = await Promise.all([listFraud(ctx.supabase), listDisputes(ctx.supabase)]);
  return <FraudDisputes fraud={fraud.rows} fraudStats={fraud.stats} disputes={disputes.rows} disputeStats={disputes.stats} />;
}
