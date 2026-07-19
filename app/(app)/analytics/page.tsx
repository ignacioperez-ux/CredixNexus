import { getContext } from "@/lib/auth/context";
import { getOverview, getPerformance, getSupervisor, getCategoryTrends, getRecurrenceAnalytics } from "@/lib/analytics/queries";
import { Analytics } from "@/components/analytics/analytics";
import { AnalyticsUnavailable } from "@/components/analytics/analytics-unavailable";

export default async function AnalyticsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  // Resiliencia: los RPC de analitica gatean por analytics.read; si el rol no lo tiene o alguno
  // falla, se degrada a un mensaje en vez de tumbar el Server Component.
  try {
    const [overview, performance, supervisor, categoryTrends, recurrence] = await Promise.all([
      getOverview(ctx.supabase),
      getPerformance(ctx.supabase),
      getSupervisor(ctx.supabase),
      getCategoryTrends(ctx.supabase),
      getRecurrenceAnalytics(ctx.supabase),
    ]);
    return <Analytics overview={overview} performance={performance} supervisor={supervisor} categoryTrends={categoryTrends} recurrence={recurrence} />;
  } catch {
    return <AnalyticsUnavailable />;
  }
}
