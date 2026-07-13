import { getContext } from "@/lib/auth/context";
import { getOverview, getPerformance, getSupervisor, getCategoryTrends } from "@/lib/analytics/queries";
import { Analytics } from "@/components/analytics/analytics";

export default async function AnalyticsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [overview, performance, supervisor, categoryTrends] = await Promise.all([
    getOverview(ctx.supabase),
    getPerformance(ctx.supabase),
    getSupervisor(ctx.supabase),
    getCategoryTrends(ctx.supabase),
  ]);
  return <Analytics overview={overview} performance={performance} supervisor={supervisor} categoryTrends={categoryTrends} />;
}
