import { getContext, hasPermission } from "@/lib/auth/context";
import { getAtRiskIncidents, listEscalationEvents, listEscalationRules, listOlaPolicies, getSlaFormOptions } from "@/lib/sla/queries";
import { Governance } from "@/components/sla/governance";

export default async function SlaGovernancePage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [risk, events, rules, ola, options, canManage] = await Promise.all([
    getAtRiskIncidents(ctx.supabase),
    listEscalationEvents(ctx.supabase),
    listEscalationRules(ctx.supabase),
    listOlaPolicies(ctx.supabase),
    getSlaFormOptions(ctx.supabase),
    hasPermission(ctx.supabase, "sla.manage"),
  ]);
  return <Governance risk={risk} events={events} rules={rules} ola={ola} options={options} canManage={canManage} />;
}
