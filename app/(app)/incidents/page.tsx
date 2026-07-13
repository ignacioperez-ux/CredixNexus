import { getContext } from "@/lib/auth/context";
import { getAccessControl } from "@/lib/auth/session";
import { listIncidents, getCaseTypeMeta, getMyMemberId } from "@/lib/incidents/queries";
import { getAssignableMembers } from "@/lib/talent/queries";
import { listSavedViews } from "@/lib/views/queries";
import { IncidentStats } from "@/components/incidents/incident-stats";
import { IncidentSplit } from "@/components/incidents/incident-split";
import { NewIncidentButton } from "@/components/incidents/new-incident-button";

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ status?: string; assignee?: string; view?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx) return null;
  const [rows, caseTypes, myMemberId, access, members, savedViews] = await Promise.all([
    listIncidents(ctx.supabase),
    getCaseTypeMeta(ctx.supabase),
    getMyMemberId(ctx.supabase, ctx.accountId),
    getAccessControl(),
    getAssignableMembers(ctx.supabase),
    listSavedViews(ctx.supabase, ctx.accountId, "incidents"),
  ]);
  // Drill accionable desde el Command Center (parametros de URL) o cola del operador por defecto.
  const defaultView = sp.view || (myMemberId && access.roles.includes("support_agent") ? "mine" : "all");
  const initialStatus = sp.status ?? "";
  const initialResp = sp.assignee ?? "";
  // Acciones contextuales por permiso (matriz de responsabilidad): Operaciones resuelve;
  // Evolucion convierte (envia a evolucion).
  const canResolve = access.isAdmin || access.perms.includes("incident.resolve");
  const canEvolve = access.isAdmin || access.perms.includes("problem.manage") || access.perms.includes("project.manage");
  const canPriority = access.isAdmin || access.perms.includes("incident.update");
  const canAssign = access.isAdmin || access.perms.includes("incident.assign");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <NewIncidentButton />
      </div>
      <IncidentStats rows={rows} />
      <IncidentSplit rows={rows} caseTypes={caseTypes} myMemberId={myMemberId} defaultView={defaultView} initialStatus={initialStatus} initialResp={initialResp}
        canResolve={canResolve} canEvolve={canEvolve} canPriority={canPriority} canAssign={canAssign} members={members} savedViews={savedViews} />
    </div>
  );
}
