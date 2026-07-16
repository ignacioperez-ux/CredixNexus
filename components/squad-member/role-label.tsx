import type { MessageKey } from "@/lib/i18n/dictionaries";

// Etiqueta i18n del squad_role (lead|product_owner|tech_lead|developer|qa|analyst|scrum_master).
const KNOWN = ["lead", "product_owner", "tech_lead", "developer", "qa", "analyst", "scrum_master"];

export function squadRoleLabel(t: (k: MessageKey) => string, role: string): string {
  return KNOWN.includes(role) ? t(("sm.role." + role) as MessageKey) : role;
}
