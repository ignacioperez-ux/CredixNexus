import type { SupabaseClient } from "@supabase/supabase-js";

const OPEN = ["new", "triaged", "assigned", "in_progress", "waiting", "reopened", "in_evolution"];

export type PartnerTicket = { incident_number: string; title: string; status: string; category: string; opened_at: string };
export type PartnerPortal = {
  party: { name: string; monogram: string; accent: string | null } | null;
  tickets: PartnerTicket[];
  kpis: { open: number; resolved: number; total: number };
};

/** Vista del partner. RLS ya aísla por tenant; además esta consulta expone SOLO
 *  campos seguros del partner: nunca transformation_score, ledger ni datos internos.
 *  En producción el party se resuelve del usuario partner autenticado. */
export async function getPartnerPortal(supabase: SupabaseClient, userPartyId?: string | null): Promise<PartnerPortal> {
  // Solo la organización (party) del usuario autenticado. SIN fallback a datos demo (UX-019): en
  // producción nunca se muestra información de otra party; si no hay organización, estado vacío honesto.
  const partyId = userPartyId ?? undefined;
  if (!partyId) return { party: null, tickets: [], kpis: { open: 0, resolved: 0, total: 0 } };

  const [partyRes, ticketsRes] = await Promise.all([
    supabase.from("party").select("display_name, legal_name, metadata").eq("id", partyId).maybeSingle(),
    supabase
      .from("incident")
      .select("incident_number, title, status, category, opened_at")
      .eq("affected_party_id", partyId)
      .order("opened_at", { ascending: false }),
  ]);

  const meta = (partyRes.data?.metadata ?? {}) as { brand_accent?: string; monogram?: string };
  const tickets = (ticketsRes.data ?? []) as PartnerTicket[];
  return {
    party: {
      name: (partyRes.data?.display_name as string) ?? "Partner",
      monogram: meta.monogram ?? "PP",
      accent: meta.brand_accent ?? null,
    },
    tickets,
    kpis: {
      open: tickets.filter((t) => OPEN.includes(t.status)).length,
      resolved: tickets.filter((t) => t.status === "resolved" || t.status === "closed").length,
      total: tickets.length,
    },
  };
}
