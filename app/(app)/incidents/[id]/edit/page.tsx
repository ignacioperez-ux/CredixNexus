import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth/context";
import { getFormOptions, getIncident } from "@/lib/incidents/queries";
import { IncidentForm } from "@/components/incidents/incident-form";
import type { IncidentInput } from "@/lib/incidents/actions";

export default async function EditIncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return null;

  const [inc, options] = await Promise.all([getIncident(ctx.supabase, id), getFormOptions(ctx.supabase)]);
  if (!inc) notFound();

  const initial: Partial<IncidentInput> = {
    title: inc.title,
    description: inc.description,
    categoryId: inc.category_id ?? "",
    affectedCiId: inc.affected_ci_id ?? "",
    affectedServiceId: inc.affected_service_id ?? "",
    affectedProductId: inc.affected_product_id ?? "",
    affectedChannelId: inc.affected_channel_id ?? "",
    affectedBusinessUnitId: inc.affected_business_unit_id ?? "",
    impact: inc.impact,
    urgency: inc.urgency,
    financialImpactEstimate: Number(inc.financial_impact_estimate ?? 0),
    caseType: inc.case_type ?? "Incident",
    amount: inc.amount != null ? Number(inc.amount) : null,
    currency: inc.currency ?? "CRC",
    transactionReference: inc.transaction_reference ?? "",
    customerName: inc.customer_name ?? "",
    sensitiveFlag: inc.sensitive_flag ?? false,
    piiFlag: inc.pii_flag ?? false,
  };

  return <IncidentForm options={options} mode="edit" incidentId={id} initial={initial} />;
}
