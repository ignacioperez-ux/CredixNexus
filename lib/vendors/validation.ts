import { ErrorCode, minLength, email as emailValidator, firstError } from "@/lib/validation";

// Dominio de Vendor Management. Logica pura para UI, acciones y pruebas.

export const VENDOR_CATEGORIES = [
  "payment_processor", "core_banking", "infrastructure", "saas", "data_provider", "security", "consulting", "other",
] as const;
export const CRITICALITIES = ["low", "medium", "high", "critical"] as const;

export type VendorValidatable = {
  code: string;
  name: string;
  category: string;
  criticality: string;
  contactEmail?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
};

export function validateVendor(i: VendorValidatable): string | null {
  const base = firstError(
    minLength(i.code, 2),
    minLength(i.name, 2),
    (VENDOR_CATEGORIES as readonly string[]).includes(i.category) ? null : ErrorCode.FORMAT,
    (CRITICALITIES as readonly string[]).includes(i.criticality) ? null : ErrorCode.FORMAT,
  );
  if (base) return base;
  if (i.contactEmail && i.contactEmail.trim().length > 0) {
    const e = emailValidator(i.contactEmail.trim());
    if (e) return e;
  }
  // Vigencia de contrato: fin no anterior al inicio (espeja el CHECK de BD)
  if (i.contractStart && i.contractEnd && i.contractEnd < i.contractStart) {
    return ErrorCode.FORMAT;
  }
  return null;
}
