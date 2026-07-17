import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Edge Function `embed` — genera embeddings gte-small (384d) on-platform (Supabase.ai).
// Tres modos:
//   { text }          -> { embedding }            (embeber la consulta del registro; no toca BD)
//   { incident_id }   -> genera y guarda 1 caso   (idempotente por content_hash)
//   { backfill:true } -> rellena casos abiertos sin embedding
// Cero mock: si el modelo falla, devuelve error (no inventa vectores).

const session = new Supabase.ai.Session("gte-small");

function contentHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

async function embed(text: string): Promise<number[]> {
  return (await session.run(text, { mean_pool: true, normalize: true })) as number[];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

type Inc = { id: string; tenant_id: string; title: string | null; description: string | null };

async function storeOne(db: ReturnType<typeof admin>, inc: Inc, priorHash?: string | null): Promise<"stored" | "skipped"> {
  const text = `${inc.title ?? ""}\n${inc.description ?? ""}`.trim();
  const h = contentHash(text);
  if (priorHash && priorHash === h) return "skipped";
  const embedding = await embed(text);
  const { error } = await db.from("incident_embedding").upsert({
    incident_id: inc.id,
    tenant_id: inc.tenant_id,
    embedding: JSON.stringify(embedding),
    content_hash: h,
    model: "gte-small",
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return "stored";
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    // Modo 1: texto -> vector.
    if (typeof body.text === "string" && body.text.trim()) {
      return json({ embedding: await embed(body.text) });
    }

    const db = admin();

    // Modo 2: un incidente -> genera y guarda.
    if (body.incident_id) {
      const { data: inc } = await db.from("incident").select("id, tenant_id, title, description").eq("id", body.incident_id).maybeSingle();
      if (!inc) return json({ error: "not_found" }, 404);
      const { data: prev } = await db.from("incident_embedding").select("content_hash").eq("incident_id", body.incident_id).maybeSingle();
      const res = await storeOne(db, inc as Inc, prev?.content_hash);
      return json({ ok: true, result: res });
    }

    // Modo 3: backfill de casos abiertos sin embedding.
    if (body.backfill) {
      const limit = Math.min(Number(body.limit ?? 100), 500);
      const { data: embs } = await db.from("incident_embedding").select("incident_id");
      const have = new Set((embs ?? []).map((e: { incident_id: string }) => e.incident_id));
      const { data: incs } = await db.from("incident").select("id, tenant_id, title, description").not("status", "in", "(resolved,closed,cancelled)").limit(2000);
      const missing = (incs ?? []).filter((i: Inc) => !have.has(i.id));
      const batch = missing.slice(0, limit);
      let stored = 0;
      for (const inc of batch) { await storeOne(db, inc as Inc); stored++; }
      return json({ ok: true, processed: stored, remaining: Math.max(0, missing.length - stored) });
    }

    return json({ error: "bad_request: provide text | incident_id | backfill" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
