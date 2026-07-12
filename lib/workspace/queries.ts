import type { SupabaseClient } from "@supabase/supabase-js";

// Agent Workspace: cockpit operativo diario. Agrega colas de casos sobre datos
// reales (RLS por tenant). Read-only; no cambia esquema ni reglas.

export type WsCase = {
  id: string;
  incident_number: string;
  title: string;
  priority: string;
  status: string;
  intake_status: string;
  sla_resolution_due_at: string | null;
  resolved_at: string | null;
  financial_impact_estimate: number;
  sensitive_flag: boolean;
  pii_flag: boolean;
  category: { name: string } | null;
  ci: { name: string } | null;
};

export type Workspace = {
  buckets: {
    myCases: WsCase[];
    toAssign: WsCase[];
    unassigned: WsCase[];
    critical: WsCase[];
    slaAtRisk: WsCase[];
    pendingTriage: WsCase[];
    reopened: WsCase[];
    sensitive: WsCase[];
    highImpact: WsCase[];
  };
  counts: Record<string, number>;
};

const OPEN_EXCLUDE = ["resolved", "closed", "cancelled"];

export async function getWorkspace(supabase: SupabaseClient, userId: string | null): Promise<Workspace> {
  const { data, error } = await supabase
    .from("incident")
    .select("id, incident_number, title, priority, status, intake_status, sla_resolution_due_at, resolved_at, financial_impact_estimate, sensitive_flag, pii_flag, assigned_user_id, assigned_member_id, category:category_id(name), ci:affected_ci_id(name), assignee:assigned_member_id(user_id)")
    .not("status", "in", `(${OPEN_EXCLUDE.join(",")})`)
    .order("opened_at", { ascending: true })
    .limit(400);
  if (error) throw new Error(error.message);

  const now = Date.now();
  const soon = now + 24 * 3600 * 1000;
  const rows = (data ?? []) as unknown as (WsCase & { assigned_user_id: string | null; assigned_member_id: string | null; assignee: { user_id: string | null } | null })[];
  const strip = (r: (typeof rows)[number]): WsCase => ({
    id: r.id, incident_number: r.incident_number, title: r.title, priority: r.priority, status: r.status,
    intake_status: r.intake_status, sla_resolution_due_at: r.sla_resolution_due_at, resolved_at: r.resolved_at,
    financial_impact_estimate: Number(r.financial_impact_estimate ?? 0), sensitive_flag: r.sensitive_flag, pii_flag: r.pii_flag,
    category: r.category, ci: r.ci,
  });

  const isMine = (r: (typeof rows)[number]) => (userId && (r.assigned_user_id === userId || r.assignee?.user_id === userId));
  const isUnassigned = (r: (typeof rows)[number]) => !r.assigned_user_id && !r.assigned_member_id;
  const slaAtRisk = (r: (typeof rows)[number]) => r.sla_resolution_due_at != null && new Date(r.sla_resolution_due_at).getTime() < soon;

  const cap = (arr: (typeof rows)[number][]) => arr.slice(0, 12).map(strip);

  const my = rows.filter(isMine);
  const unassigned = rows.filter(isUnassigned);
  // Admitidos (status "triaged") que aun no tienen responsable: caso recien admitido por
  // Operaciones, listo para asignar. Evita que "desaparezca" tras admitir.
  const toAssign = rows.filter((r) => r.status === "triaged" && isUnassigned(r));
  const critical = rows.filter((r) => r.priority === "p1_critical" || r.priority === "p2_high");
  const atRisk = rows.filter(slaAtRisk);
  const pendingTriage = rows.filter((r) => r.intake_status === "pending");
  const reopened = rows.filter((r) => r.status === "reopened");
  const sensitive = rows.filter((r) => r.sensitive_flag || r.pii_flag);
  const highImpact = rows.filter((r) => Number(r.financial_impact_estimate ?? 0) > 0).sort((a, b) => Number(b.financial_impact_estimate) - Number(a.financial_impact_estimate));

  return {
    buckets: {
      myCases: cap(my), toAssign: cap(toAssign), unassigned: cap(unassigned), critical: cap(critical), slaAtRisk: cap(atRisk),
      pendingTriage: cap(pendingTriage), reopened: cap(reopened), sensitive: cap(sensitive), highImpact: cap(highImpact),
    },
    counts: {
      open: rows.length, myCases: my.length, toAssign: toAssign.length, unassigned: unassigned.length, critical: critical.length,
      slaAtRisk: atRisk.length, pendingTriage: pendingTriage.length, reopened: reopened.length,
      sensitive: sensitive.length, highImpact: highImpact.length,
    },
  };
}
