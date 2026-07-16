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
