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
  group: MessageKey;  // seccion del hub de datos maestros (agrupacion visual)
  fields: Field[];
  listCols: string[]; // campos a mostrar en la lista (ademas de code/name/status)
};

const CHANNEL_TYPES = [
  "web", "mobile", "api", "contact_center", "branch", "email", "webhook", "batch",
  "portal_partner", "phone", "whatsapp", "social", "chat", "kiosk", "assisted", "sms",
];
const PRIORITIES = ["p1_critical", "p2_high", "p3_medium", "p4_low"];
// Espejan enums reales del esquema (impact_level, governance_type) -> permitido (§11).
const IMPACT_LEVELS = ["critical", "high", "medium", "low"];
const GOVERNANCE_TYPES = ["policy", "norm", "procedure", "process", "control"];

export const CATALOGS: Catalog[] = [
  {
    key: "business-units", table: "business_unit", title: "md.cat.business_unit", group: "md.grp.org",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 200 },
    ],
    listCols: [],
  },
  {
    key: "products", table: "product", title: "md.cat.product", group: "md.grp.service",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 250 },
      { name: "product_family", label: "md.f.product_family", type: "text", max: 120 },
      { name: "business_unit_id", label: "md.f.business_unit", type: "fk", fkTable: "business_unit" },
    ],
    listCols: ["product_family", "business_unit_id"],
  },
  {
    key: "channels", table: "channel", title: "md.cat.channel", group: "md.grp.service",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 200 },
      { name: "channel_type", label: "md.f.channel_type", type: "enum", required: true, options: CHANNEL_TYPES },
    ],
    listCols: ["channel_type"],
  },
  {
    key: "skills", table: "skill", title: "md.cat.skill", group: "md.grp.org",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 150 },
      { name: "category", label: "md.f.category", type: "text", max: 80 },
    ],
    listCols: ["category"],
  },
  {
    key: "incident-categories", table: "incident_category", title: "md.cat.incident_category", group: "md.grp.service",
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
    key: "squads", table: "squad", title: "md.cat.squad", group: "md.grp.org",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 200 },
      { name: "capacity_points", label: "md.f.capacity", type: "number", min: 0, max: 100 },
      { name: "business_unit_id", label: "md.f.business_unit", type: "fk", fkTable: "business_unit" },
    ],
    listCols: ["capacity_points", "business_unit_id"],
  },
  {
    key: "processes", table: "process", title: "md.cat.process", group: "md.grp.governance",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 250 },
      { name: "process_level", label: "md.f.process_level", type: "enum", required: true, options: ["macro", "process", "micro"] },
      { name: "business_unit_id", label: "md.f.business_unit", type: "fk", fkTable: "business_unit" },
      { name: "parent_process_id", label: "md.f.parent_process", type: "fk", fkTable: "process" },
    ],
    listCols: ["process_level", "business_unit_id"],
  },
  {
    // Sistemas / aplicaciones (CMDB). /cmdb es el explorador; aqui el alta/edicion.
    // environment y data_classification usan su default (NOT NULL con default) -> se omiten.
    key: "systems", table: "configuration_item", title: "md.cat.configuration_item", group: "md.grp.tech",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 200 },
      { name: "ci_type", label: "md.f.ci_type", type: "text", required: true, max: 60 },
      { name: "criticality", label: "md.f.criticality", type: "enum", required: true, options: IMPACT_LEVELS },
      { name: "service_id", label: "md.f.service", type: "fk", fkTable: "service" },
      { name: "vendor_id", label: "md.f.vendor", type: "fk", fkTable: "vendor" },
    ],
    listCols: ["ci_type", "criticality"],
  },
  {
    // Tipos de caso: clasificacion transversal. category y domain son NOT NULL (varchar libre).
    key: "case-types", table: "case_type", title: "md.cat.case_type", group: "md.grp.service",
    fields: [
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 200 },
      { name: "category", label: "md.f.category", type: "text", required: true, max: 60 },
      { name: "domain", label: "md.f.domain", type: "text", required: true, max: 60 },
    ],
    listCols: ["category", "domain"],
  },
  {
    // Items de gobierno (GRC): politicas, normas, procedimientos, procesos, controles.
    key: "governance-items", table: "governance_item", title: "md.cat.governance_item", group: "md.grp.governance",
    fields: [
      { name: "item_type", label: "md.f.item_type", type: "enum", required: true, options: GOVERNANCE_TYPES },
      { name: "code", label: "md.f.code", type: "code", required: true },
      { name: "name", label: "md.f.name", type: "text", required: true, min: 2, max: 200 },
      { name: "description", label: "md.f.description", type: "text", max: 500 },
    ],
    listCols: ["item_type"],
  },
];

export function getCatalog(key: string): Catalog | undefined {
  return CATALOGS.find((c) => c.key === key);
}
