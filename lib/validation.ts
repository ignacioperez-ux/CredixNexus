// Validaciones reutilizables por naturaleza de dato (CLAUDE.md §10.3).
// Cada funcion devuelve un CODIGO de error (ERR_*) o null si es valida.
// El codigo se traduce a mensaje via i18n (err.<CODE>) en la capa de UI.
// Estas mismas validaciones deben replicarse en backend (§10.7).

export const ErrorCode = {
  REQUIRED: "ERR_REQUIRED_FIELD",
  FORMAT: "ERR_INVALID_FORMAT",
  MIN_LENGTH: "ERR_MIN_LENGTH",
  INVALID_REFERENCE: "ERR_INVALID_REFERENCE",
  PERMISSION: "ERR_PERMISSION_DENIED",
  DUPLICATE: "ERR_DUPLICATE_CODE",
  STATE: "ERR_INVALID_STATE",
} as const;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function required(value: string | null | undefined): string | null {
  if (value == null || value.trim().length === 0) return ErrorCode.REQUIRED;
  return null;
}

export function email(value: string | null | undefined): string | null {
  const r = required(value);
  if (r) return r;
  return EMAIL_RE.test((value as string).trim()) ? null : ErrorCode.FORMAT;
}

export function minLength(value: string | null | undefined, n: number): string | null {
  const r = required(value);
  if (r) return r;
  return (value as string).length >= n ? null : ErrorCode.MIN_LENGTH;
}

/** Ejecuta varios validadores y devuelve el primer error, o null. */
export function firstError(...checks: (string | null)[]): string | null {
  for (const c of checks) if (c) return c;
  return null;
}
