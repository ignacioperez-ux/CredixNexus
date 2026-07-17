import type { SupabaseClient } from "@supabase/supabase-js";

// Puente a la Edge Function `embed` (gte-small, 384d). Cero mock: si la funcion falla o el
// embedding no esta listo, devuelve null y la UI degrada (no inventa vectores).

export type SemanticHit = { incident_id: string; incident_number: string; title: string; status: string; similarity: number };

/** Embeber texto de consulta (modo { text } de la Edge Function). */
export async function embedQuery(supabase: SupabaseClient, text: string): Promise<number[] | null> {
  const q = text.trim();
  if (!q) return null;
  try {
    const { data, error } = await supabase.functions.invoke("embed", { body: { text: q } });
    if (error || !Array.isArray(data?.embedding)) return null;
    return data.embedding as number[];
  } catch {
    return null;
  }
}

/** Dispara la generacion/actualizacion del embedding de un caso (modo { incident_id }).
 *  Fire-and-forget desde create/update: no bloquea el registro; idempotente por content_hash.
 *  Nota: en despliegues serverless conviene respaldar con un webhook/cron (el backfill re-sincroniza). */
export async function triggerIncidentEmbedding(supabase: SupabaseClient, incidentId: string): Promise<void> {
  try {
    await supabase.functions.invoke("embed", { body: { incident_id: incidentId } });
  } catch {
    // No-fatal: el embedding es dato derivado; el backfill lo recupera.
  }
}
