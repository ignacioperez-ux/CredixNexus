import { describe, it, expect } from "vitest";
import { nextNodeIds, allowedOutcomes } from "./graph";
import { validateDefinition, isPublishable } from "./validation";
import type { SimpleNode, SimpleEdge } from "./graph";

const edges: SimpleEdge[] = [
  { from_node_id: "cab", to_node_id: "impl", guard: "approved" },
  { from_node_id: "cab", to_node_id: "rech", guard: "rejected" },
  { from_node_id: "start", to_node_id: "reg", guard: null },
];

describe("nextNodeIds", () => {
  it("sigue la arista cuya guarda casa el resultado", () => {
    expect(nextNodeIds(edges, "cab", "approved")).toEqual(["impl"]);
    expect(nextNodeIds(edges, "cab", "rejected")).toEqual(["rech"]);
  });
  it("una arista sin guarda es camino por defecto", () => {
    expect(nextNodeIds(edges, "start", "auto")).toEqual(["reg"]);
    expect(nextNodeIds(edges, "start", "done")).toEqual(["reg"]);
  });
  it("sin coincidencia devuelve vacio", () => {
    expect(nextNodeIds(edges, "cab", "done")).toEqual([]);
  });
});

describe("allowedOutcomes", () => {
  it("aprobacion permite approved/rejected", () => {
    expect(allowedOutcomes("approval")).toEqual(["approved", "rejected"]);
  });
  it("tarea permite done", () => {
    expect(allowedOutcomes("task")).toEqual(["done"]);
  });
  it("start/end no admiten avance manual", () => {
    expect(allowedOutcomes("start")).toEqual([]);
    expect(allowedOutcomes("end")).toEqual([]);
  });
});

describe("validateDefinition", () => {
  const good: SimpleNode[] = [
    { id: "s", code: "START", node_type: "start" },
    { id: "t", code: "TASK", node_type: "task" },
    { id: "a", code: "CAB", node_type: "approval" },
    { id: "e1", code: "OK", node_type: "end" },
    { id: "e2", code: "NO", node_type: "end" },
  ];
  const goodEdges: SimpleEdge[] = [
    { from_node_id: "s", to_node_id: "t", guard: null },
    { from_node_id: "t", to_node_id: "a", guard: null },
    { from_node_id: "a", to_node_id: "e1", guard: "approved" },
    { from_node_id: "a", to_node_id: "e2", guard: "rejected" },
  ];

  it("una definicion bien formada no tiene incidencias", () => {
    expect(validateDefinition(good, goodEdges)).toEqual([]);
    expect(isPublishable(good, goodEdges)).toBe(true);
  });
  it("detecta ausencia de start y de end", () => {
    const codes = validateDefinition([{ id: "t", code: "T", node_type: "task" }], []).map((i) => i.code);
    expect(codes).toContain("wf.issue.no_start");
    expect(codes).toContain("wf.issue.no_end");
  });
  it("detecta multiples start", () => {
    const nodes: SimpleNode[] = [...good, { id: "s2", code: "START2", node_type: "start" }];
    expect(validateDefinition(nodes, goodEdges).map((i) => i.code)).toContain("wf.issue.multi_start");
  });
  it("detecta nodo sin salida (dead-end)", () => {
    const nodes: SimpleNode[] = [
      { id: "s", code: "START", node_type: "start" },
      { id: "t", code: "TASK", node_type: "task" },
      { id: "e", code: "END", node_type: "end" },
    ];
    const e: SimpleEdge[] = [{ from_node_id: "s", to_node_id: "e", guard: null }];
    const issues = validateDefinition(nodes, e);
    expect(issues.some((i) => i.code === "wf.issue.dead_end" && i.node === "TASK")).toBe(true);
  });
  it("detecta aprobacion sin ambas ramas", () => {
    const e: SimpleEdge[] = [
      { from_node_id: "s", to_node_id: "t", guard: null },
      { from_node_id: "t", to_node_id: "a", guard: null },
      { from_node_id: "a", to_node_id: "e1", guard: "approved" },
    ];
    expect(validateDefinition(good, e).some((i) => i.code === "wf.issue.approval_branches")).toBe(true);
  });
});
