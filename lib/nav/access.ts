// Visibilidad por permiso (navegacion y acciones por rol). Puro y testeable.
// Regla: admin ve todo; sin permiso requerido = visible; si no, requiere el/los permiso(s).

export function canSeeNav(perm: string | string[] | undefined, perms: string[], isAdmin: boolean): boolean {
  if (isAdmin || !perm) return true;
  return Array.isArray(perm) ? perm.some((p) => perms.includes(p)) : perms.includes(perm);
}
