// Capacidades del miembro dentro del squad (modelo v2.0, §1). Se derivan del squad_role VIGENTE
// por squad (una persona puede ser PO en uno y SME en otro). Logica pura -> compartida y testeable.
// Base (developer/qa/analyst/SME): edita SOLO sus tareas; lee las del squad.
// TL (tech_lead/lead/scrum_master): ademas crea/edita/reasigna tareas y gestiona blockers del squad.
// PO (product_owner): ademas ordena el backlog del squad y edita descripciones de sus iniciativas.

const TL_ROLES = ["tech_lead", "lead", "scrum_master"];
const PO_ROLES = ["product_owner"];

export function isSquadTL(role: string): boolean { return TL_ROLES.includes(role); }
export function isSquadPO(role: string): boolean { return PO_ROLES.includes(role); }

/** Puede crear / editar / reasignar tareas y gestionar blockers de ESE squad (TL o PO). */
export function canManageSquadTasks(role: string): boolean { return isSquadTL(role) || isSquadPO(role); }

/** Puede ordenar el backlog y editar descripciones de iniciativas de ESE squad (PO). */
export function canOrderBacklog(role: string): boolean { return isSquadPO(role); }
