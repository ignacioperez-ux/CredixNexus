import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { listIncidents, getCaseTypeMeta, getMyMemberId } from "@/lib/incidents/queries";
import { IncidentStats } from "@/components/incidents/incident-stats";
import { IncidentSplit } from "@/components/incidents/incident-split";
import { NewIncidentButton } from "@/components/incidents/new-incident-button";

export default async function IncidentsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [rows, caseTypes, myMemberId, access] = await Promise.all([
    listIncidents(ctx.supabase),
    getCaseTypeMeta(ctx.supabase),
    getMyMemberId(ctx.supabase, ctx.accountId),
    getAccessControl(),
  ]);
  // El operador aterriza en su cola personal; el resto ve todo por defecto.
  const defaultView = myMemberId && access.roles.includes("support_agent") ? "mine" : "all";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <NewIncidentButton />
      </div>
      <IncidentStats rows={rows} />
      <IncidentSplit rows={rows} caseTypes={caseTypes} myMemberId={myMemberId} defaultView={defaultView} />
    </div>
  );
}
