import { getContext } from "@/lib/auth/context";
import { getKbReviewQueue } from "@/lib/knowledge/queries";
import { KbReviewBoard } from "@/components/knowledge/kb-review-board";

// Tablero de revision de conocimiento: borradores (capturados al cierre o manuales) pendientes de
// revisar y publicar. Gate knowledge.manage (curador) via ROUTE_PERMISSIONS.
export default async function KbReviewPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const items = await getKbReviewQueue(ctx.supabase);
  return <KbReviewBoard items={items} />;
}
