// Reglas puras de transicion de estado del caso (A1). Compartidas por la UI (deshabilitar el
// boton) y el server action (rechazo autoritativo). Logica pura -> testeable sin DB.

/** Estados que EXIGEN al menos un responsable asignado para poder entrar. */
export function requiresAssignee(targetStatus: string): boolean {
  return targetStatus === "assigned";
}

/** Codigo de error si la transicion es invalida por falta de responsable; null si es valida. */
export function assignmentGuard(targetStatus: string, hasAssignee: boolean): string | null {
  return requiresAssignee(targetStatus) && !hasAssignee ? "ERR_NO_ASSIGNEE" : null;
}

// A3: la asignacion es editable entre Admitido y antes de Resuelto. En Resuelto/Cerrado/Cancelado
// y En Evolucion (ancla) queda de SOLO LECTURA.
const ASSIGNMENT_LOCKED = ["resolved", "closed", "cancelled", "in_evolution"];
export function assignmentEditable(status: string): boolean {
  return !ASSIGNMENT_LOCKED.includes(status);
}

// A3: nunca dejar cero responsables si el estado es >= Asignado (ya requiere responsable).
const REQUIRE_ASSIGNEE_STATES = ["assigned", "in_progress", "waiting", "reopened"];
export function mustKeepAtLeastOne(status: string): boolean {
  return REQUIRE_ASSIGNEE_STATES.includes(status);
}
