import type { SimpleNode, SimpleEdge } from "./graph";

// Validacion de una definicion antes de publicarla (draft -> active).
// Espeja las precondiciones del motor (start_workflow exige exactamente 1 start).

export type DefIssue = { code: string; node?: string };

export function validateDefinition(nodes: SimpleNode[], edges: SimpleEdge[]): DefIssue[] {
  const issues: DefIssue[] = [];
  const starts = nodes.filter((n) => n.node_type === "start");
  const ends = nodes.filter((n) => n.node_type === "end");

  if (starts.length === 0) issues.push({ code: "wf.issue.no_start" });
  if (starts.length > 1) issues.push({ code: "wf.issue.multi_start" });
  if (ends.length === 0) issues.push({ code: "wf.issue.no_end" });

  const ids = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (!ids.has(e.from_node_id) || !ids.has(e.to_node_id)) {
      issues.push({ code: "wf.issue.bad_edge" });
      break;
    }
  }

  // Todo nodo que no sea 'end' debe tener al menos una arista de salida.
  const withOut = new Set(edges.map((e) => e.from_node_id));
  for (const n of nodes) {
    if (n.node_type !== "end" && !withOut.has(n.id)) {
      issues.push({ code: "wf.issue.dead_end", node: n.code });
    }
  }

  // Un nodo de aprobacion deberia enrutar tanto approved como rejected.
  for (const n of nodes.filter((x) => x.node_type === "approval")) {
    const guards = edges.filter((e) => e.from_node_id === n.id).map((e) => e.guard);
    if (!guards.includes("approved") || !guards.includes("rejected")) {
      issues.push({ code: "wf.issue.approval_branches", node: n.code });
    }
  }

  return issues;
}

export function isPublishable(nodes: SimpleNode[], edges: SimpleEdge[]): boolean {
  return validateDefinition(nodes, edges).length === 0;
}
