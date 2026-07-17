import type { SupabaseClient } from "@supabase/supabase-js";

// Consultas de enlaces de duplicado (Fase 3). RLS acota por tenant. Un caso puede ser:
//  - PRIMARIO (canonico): tiene N casos marcados como su duplicado.
//  - DUPLICADO: apunta a UN caso primario (a lo sumo uno activo).

export type DupLinkedCase = {
  link_id: string;
  source: string;
  confidence: number | null;
  reason: string | null;
  incident_id: string;
  incident_number: string;
  title: string;
  status: string;
};

export type DuplicateLinks = {
  duplicateOf: DupLinkedCase | null; // si este caso es duplicado, su canonico
  primaryOf: DupLinkedCase[]; // si este caso es canonico, sus duplicados
};

type Row = {
  id: string;
  source: string;
  confidence: number | null;
  reason: string | null;
  inc: { id: string; incident_number: string; title: string; status: string } | null;
};

function toLinked(r: Row): DupLinkedCase | null {
  if (!r.inc) return null;
  return { link_id: r.id, source: r.source, confidence: r.confidence, reason: r.reason, incident_id: r.inc.id, incident_number: r.inc.incident_number, title: r.inc.title, status: r.inc.status };
}

export async function getDuplicateLinks(supabase: SupabaseClient, incidentId: string): Promise<DuplicateLinks> {
  // Este caso como DUPLICADO -> su primario (embebe incident via FK primary_incident_id).
  const { data: asDup } = await supabase
    .from("incident_duplicate_link")
    .select("id, source, confidence, reason, inc:incident!primary_incident_id(id, incident_number, title, status)")
    .eq("duplicate_incident_id", incidentId)
    .eq("status", "active")
    .maybeSingle();

  // Este caso como PRIMARIO -> sus duplicados (embebe incident via FK duplicate_incident_id).
  const { data: asPrimary } = await supabase
    .from("incident_duplicate_link")
    .select("id, source, confidence, reason, inc:incident!duplicate_incident_id(id, incident_number, title, status)")
    .eq("primary_incident_id", incidentId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return {
    duplicateOf: asDup ? toLinked(asDup as unknown as Row) : null,
    primaryOf: ((asPrimary ?? []) as unknown as Row[]).map(toLinked).filter((x): x is DupLinkedCase => x !== null),
  };
}
