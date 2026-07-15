// Catalogo de conceptos para ayudas contextuales (Fase 1). Data-driven: cada concepto tiene
// termino, definicion corta, definicion larga y EJEMPLO Credix, via i18n (concept.<code>.*).
// El ConceptTip se activa desde cualquier pantalla donde se mencione el concepto.
export const CONCEPTS = [
  "tribe", "squad", "chapter", "guild",
  "po", "business_owner", "tech_lead", "agile_lead",
  "domain", "run_change", "wsjf", "initiative",
] as const;
export type ConceptCode = (typeof CONCEPTS)[number];

export function isConcept(v: string): v is ConceptCode {
  return (CONCEPTS as readonly string[]).includes(v);
}
