// Catalogo de servicios — validacion pura del formulario dinamico (testeable).
// El form_schema define los campos; validateFormData verifica requeridos y tipos.

import { ErrorCode } from "@/lib/validation";

export const FIELD_TYPES = ["text", "textarea", "number", "select", "date"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type FormField = { key: string; label: string; type: FieldType; required?: boolean; options?: string[] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim().length === 0);
}

/** Valida form_data contra el schema. Devuelve un mapa {campo: codigoError}; vacio si es valido. */
export function validateFormData(schema: FormField[], data: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of schema) {
    const v = data[f.key];
    if (isEmpty(v)) {
      if (f.required) errors[f.key] = ErrorCode.REQUIRED;
      continue;
    }
    switch (f.type) {
      case "number":
        if (Number.isNaN(Number(v))) errors[f.key] = ErrorCode.FORMAT;
        break;
      case "select":
        if (!(f.options ?? []).includes(String(v))) errors[f.key] = ErrorCode.INVALID_REFERENCE;
        break;
      case "date":
        if (!DATE_RE.test(String(v)) || Number.isNaN(Date.parse(String(v)))) errors[f.key] = ErrorCode.FORMAT;
        break;
      default:
        break; // text/textarea: cualquier no-vacio es valido
    }
  }
  return errors;
}

export function hasErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0;
}

/** Resumen legible de form_data para la descripcion del caso ancla. */
export function summarizeFormData(schema: FormField[], data: Record<string, unknown>): string {
  return schema
    .map((f) => `${f.label}: ${isEmpty(data[f.key]) ? "—" : String(data[f.key])}`)
    .join("\n");
}

// ---- Validacion del item de catalogo (admin) ----
// categoryId referencia el maestro service_category (datos maestros §10, no texto libre).
export type ItemInput = { code: string; name: string; categoryId: string; slaHours: number; formSchema: FormField[] };

export function validateItem(i: ItemInput): string | null {
  if (!i.code || i.code.trim().length < 2) return ErrorCode.MIN_LENGTH;
  if (!i.name || i.name.trim().length < 3) return ErrorCode.MIN_LENGTH;
  if (!i.categoryId || i.categoryId.trim().length === 0) return ErrorCode.REQUIRED;
  if (!(i.slaHours > 0 && i.slaHours <= 8760)) return ErrorCode.FORMAT;
  for (const f of i.formSchema) {
    if (!f.key || !f.label) return ErrorCode.REQUIRED;
    if (!(FIELD_TYPES as readonly string[]).includes(f.type)) return ErrorCode.FORMAT;
    if (f.type === "select" && (!f.options || f.options.length === 0)) return ErrorCode.FORMAT;
  }
  return null;
}

// ---- Validacion de la categoria de catalogo (maestro con i18n) ----
export type CategoryInput = { code: string; nameEs: string; nameEn: string };

export function validateCategory(c: CategoryInput): string | null {
  if (!c.code || c.code.trim().length < 2) return ErrorCode.MIN_LENGTH;
  if (!c.nameEs || c.nameEs.trim().length < 2) return ErrorCode.REQUIRED;
  if (!c.nameEn || c.nameEn.trim().length < 2) return ErrorCode.REQUIRED;
  return null;
}
