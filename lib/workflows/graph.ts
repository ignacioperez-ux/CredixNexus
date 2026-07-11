// Logica pura del grafo de workflow. Espeja el ruteo del motor PL/pgSQL
// (aristas cuya guarda es null o casa el resultado). Reutilizable en UI y pruebas.

export type NodeType = "start" | "task" | "approval" | "automated" | "end";

export type SimpleNode = { id: string; code: string; node_type: NodeType };
export type SimpleEdge = { from_node_id: string; to_node_id: string; guard: string | null };

/** Nodos destino alcanzables desde un nodo dado un resultado. */
export function nextNodeIds(edges: SimpleEdge[], fromNodeId: string, outcome: string): string[] {
  return edges
    .filter((e) => e.from_node_id === fromNodeId && (e.guard === null || e.guard === outcome))
    .map((e) => e.to_node_id);
}

/** Resultados que un paso activo puede tomar segun el tipo de nodo. */
export function allowedOutcomes(nodeType: NodeType): string[] {
  switch (nodeType) {
    case "approval":
      return ["approved", "rejected"];
    case "task":
    case "automated":
      return ["done"];
    default:
      return [];
  }
}
