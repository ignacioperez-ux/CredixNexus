import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { getActiveRuleConfig, getRecommendations } from "@/lib/rules/queries";
import { RuleConfig } from "@/components/rules/rule-config";
import { RecommendationsQueue } from "@/components/rules/recommendations-queue";

export default async function RulesPage() {
  const ctx = await getContext();
  if (!ctx) return null;

  const [config, recommendations, access] = await Promise.all([
    getActiveRuleConfig(ctx.supabase),
    getRecommendations(ctx.supabase),
    getAccessControl(),
  ]);
  // Decidir recomendaciones = potestad del RC (negocio). Otros roles ven la cola en solo-lectura.
  const canDecide = access.isAdmin || access.perms.includes("recommendation.decide");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
      <RecommendationsQueue rows={recommendations} canDecide={canDecide} />
      {config?.rule && (
        <RuleConfig rule={config.rule} version={config.version ?? null} governance={config.governance} />
      )}
    </div>
  );
}
