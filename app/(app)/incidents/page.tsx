import { getContext } from "@/lib/auth/context";
import { listIncidents, getCaseTypeMeta } from "@/lib/incidents/queries";
import { IncidentStats } from "@/components/incidents/incident-stats";
import { IncidentTable } from "@/components/incidents/incident-table";
import { NewIncidentButton } from "@/components/incidents/new-incident-button";

export default async function IncidentsPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [rows, caseTypes] = await Promise.all([listIncidents(ctx.supabase), getCaseTypeMeta(ctx.supabase)]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <NewIncidentButton />
      </div>
      <IncidentStats rows={rows} />
      <IncidentTable rows={rows} caseTypes={caseTypes} />
    </div>
  );
}
