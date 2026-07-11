import type { SupabaseClient } from "@supabase/supabase-js";

export type LedgerEvent = {
  block_height: number;
  timestamp: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  current_hash: string;
  verified: boolean;
};

export type LedgerData = {
  events: LedgerEvent[];
  stats: { total: number; verified: number; broken: number };
};

/** Eventos recientes del ledger + verificación criptográfica de la cadena (por bloque). */
export async function getLedger(supabase: SupabaseClient, tenantId: string, limit = 200): Promise<LedgerData> {
  const [eventsRes, chainRes] = await Promise.all([
    supabase
      .from("immutable_audit_event")
      .select("block_height, timestamp, actor_type, actor_id, action, entity_type, entity_id, current_hash")
      .order("block_height", { ascending: false })
      .limit(limit),
    supabase.rpc("verify_audit_chain", { p_tenant_id: tenantId }),
  ]);

  const chain = (chainRes.data ?? []) as { block_height: number; hash_ok: boolean; link_ok: boolean }[];
  const okByBlock = new Map<number, boolean>();
  let verified = 0;
  let broken = 0;
  for (const c of chain) {
    const ok = c.hash_ok && c.link_ok;
    okByBlock.set(c.block_height, ok);
    if (ok) verified++;
    else broken++;
  }

  const rows = (eventsRes.data ?? []) as Omit<LedgerEvent, "verified">[];
  const events: LedgerEvent[] = rows.map((r) => ({ ...r, verified: okByBlock.get(r.block_height) ?? true }));

  return { events, stats: { total: chain.length, verified, broken } };
}
