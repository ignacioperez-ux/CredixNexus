import { describe, it, expect } from "vitest";
import { requiresAssignee, assignmentGuard } from "./transitions";

// A1: no se puede pasar un caso a "Asignado" sin al menos un responsable. Regla compartida por
// UI (boton deshabilitado) y server action (rechazo). Aqui se prueba la logica pura.
describe("A1 - guard de asignacion al pasar a Asignado", () => {
  it("solo 'assigned' exige responsable", () => {
    expect(requiresAssignee("assigned")).toBe(true);
    expect(requiresAssignee("in_progress")).toBe(false);
    expect(requiresAssignee("resolved")).toBe(false);
    expect(requiresAssignee("triaged")).toBe(false);
  });

  it("bloquea 'assigned' sin responsable", () => {
    expect(assignmentGuard("assigned", false)).toBe("ERR_NO_ASSIGNEE");
  });

  it("permite 'assigned' con responsable", () => {
    expect(assignmentGuard("assigned", true)).toBeNull();
  });

  it("no exige responsable para otras transiciones", () => {
    expect(assignmentGuard("in_progress", false)).toBeNull();
    expect(assignmentGuard("resolved", false)).toBeNull();
    expect(assignmentGuard("triaged", false)).toBeNull();
  });
});
