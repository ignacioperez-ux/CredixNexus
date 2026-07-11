import type { MessageKey } from "@/lib/i18n/dictionaries";

// Registro de catálogos administrables (whitelist). Describe campos y validaciones
// por catálogo. Es metadata de esquema (no dato de negocio) -> no viola la regla de
// no-hardcode. Los VALORES siempre vienen de la BD.

export type FieldType = "text" | "code" | "number" | "bool" | "enum" | "fk";

export type Field = {
  name: string;
  label: MessageKey;
  type: FieldType;
  required?: boolean;
  min?: number;
  max?: number;
  options?: string[]; // para enum (espeja el CHECK/enum del esquema)
  fkTable?: string;   // para fk: catalogo/tabla referenciada (opciones desde la BD)
};

export type Catalog = {
  key: string;
  table: string;
  title: MessageKey;
  fields: Field[];
  listCols: string[]; // campos a mostrar en la lista (ademas de code/name/status)
};

const CHANNEL_TYPES = [
  "web", "mobile", "api", "contact_center", "branch", "email", "webhook", "batch",
  "portal_partner", "phone", "whatsapp", "social", "chat", "kiosk", "assisted", "sms",
];
const PRIORITIES = ["p1_critical", "p2_high", "p3_medium", "p4_low"];

export const CATALOGS: Catalog[] = [
  {
    key: "business-units", table: "business_unit", title: "md.cat.business_unit",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 200 },
    ],
    listCols: [],
  },
  {
    key: "products", table: "product", title: "md.cat.product",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 250 },
      { name: "product_family", label: "md.f.product_family", type: "text", max: 120 },
      { name: "business_unit_id", label: "md.f.business_unit", type: "fk", fkTable: "business_unit" },
    ],
    listCols: ["product_family", "business_unit_id"],
  },
  {
    key: "channels", table: "channel", title: "md.cat.channel",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 200 },
      { name: "channel_type", label: "md.f.channel_type", type: "enum", required: true, options: CHANNEL_TYPES },
    ],
    listCols: ["channel_type"],
  },
  {
    key: "skills", table: "skill", title: "md.cat.skill",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 150 },
      { name: "category", label: "md.f.category", type: "text", max: 80 },
    ],
    listCols: ["category"],
  },
  {
    key: "incident-categories", table: "incident_category", title: "md.cat.incident_category",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 200 },
      { name: "default_team", label: "md.f.default_team", type: "text", max: 100 },
      { name: "default_priority", label: "md.f.default_priority", type: "enum", options: PRIORITIES },
      { name: "requires_rca", label: "md.f.requires_rca", type: "bool" },
      { name: "requires_kb", label: "md.f.requires_kb", type: "bool" },
    ],
    listCols: ["default_team", "default_priority"],
  },
  {
    key: "squads", table: "squad", title: "md.cat.squad",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 200 },
      { name: "capacity_points", label: "md.f.capacity", type: "number", min: 0, max: 100 },
      { name: "business_unit_id", label: "md.f.business_unit", type: "fk", fkTable: "business_unit" },
    ],
    listCols: ["capacity_points", "business_unit_id"],
  },
  {
    key: "processes", table: "process", title: "md.cat.process",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 250 },
      { name: "process_level", label: "md.f.process_level", type: "enum", required: true, options: ["macro", "process", "micro"] },
      { name: "business_unit_id", label: "md.f.business_unit", type: "fk", fkTable: "business_unit" },
      { name: "parent_process_id", label: "md.f.parent_process", type: "fk", fkTable: "process" },
    ],
    listCols: ["process_level", "business_unit_id"],
  },
];

export function getCatalog(key: string): Catalog | undefined {
  return CATALOGS.find((c) => c.key === key);
}
