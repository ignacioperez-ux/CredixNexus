// Catalogo de conceptos para ayudas contextuales (Fase 1). Data-driven: cada concepto tiene
// termino, definicion corta, definicion larga y EJEMPLO Credix, via i18n (concept.<code>.*).
// El ConceptTip se activa desde cualquier pantalla donde se mencione el concepto.
export const CONCEPTS = [
  "tribe", "squad", "chapter", "guild",
  "po", "business_owner", "tech_lead", "agile_lead",
  "domain", "run_change", "wsjf", "initiative",
  // Conceptos ITSM / mesa (para regar ayudas en las pantallas operativas)
  "case", "major_incident", "change_cab", "problem", "roi", "capacity",
] as const;
export type ConceptCode = (typeof CONCEPTS)[number];

export function isConcept(v: string): v is ConceptCode {
  return (CONCEPTS as readonly string[]).includes(v);
}

// Mapa ruta -> concepto: el header muestra un ConceptTip junto al titulo de la pantalla.
// El prefijo mas especifico gana (ordenados por longitud al resolver).
export const CONCEPT_BY_ROUTE: { prefix: string; concept: ConceptCode }[] = [
  { prefix: "/evolucion/mapa", concept: "tribe" },
  { prefix: "/projects/portafolio", concept: "wsjf" },
  { prefix: "/projects", concept: "initiative" },
  { prefix: "/casos-convertidos", concept: "initiative" },
  { prefix: "/squads", concept: "squad" },
  { prefix: "/workload", concept: "capacity" },
  { prefix: "/talent", concept: "chapter" },
  { prefix: "/major-incidents", concept: "major_incident" },
  { prefix: "/changes", concept: "change_cab" },
  { prefix: "/problems", concept: "problem" },
  { prefix: "/incidents", concept: "case" },
];

export function conceptForPath(pathname: string): ConceptCode | null {
  const m = CONCEPT_BY_ROUTE
    .filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return m ? m.concept : null;
}
