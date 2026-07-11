import { getContext } from "@/lib/auth/context";
import { getActiveRuleConfig, getRecommendations } from "@/lib/rules/queries";
import { RuleConfig } from "@/components/rules/rule-config";
import { RecommendationsQueue } from "@/components/rules/recommendations-queue";

export default async function RulesPage() {
  const ctx = await getContext();
  if (!ctx) return null;

  const [config, recommendations] = await Promise.all([
    getActiveRuleConfig(ctx.supabase),
    getRecommendations(ctx.supabase),
  ]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
      <RecommendationsQueue rows={recommendations} />
      {config?.rule && (
        <RuleConfig rule={config.rule} version={config.version ?? null} governance={config.governance} />
      )}
    </div>
  );
}
