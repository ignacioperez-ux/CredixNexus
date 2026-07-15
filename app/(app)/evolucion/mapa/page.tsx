import { getContext, hasPermission } from "@/lib/auth/context";
import { listTribes, listSquadsLite } from "@/lib/tribes/queries";
import { TribeMap } from "@/components/tribes/tribe-map";

// Mapa de Tribus (Fase 1): vista de alto nivel tribu x squad + gestion inline (squad.manage).
export default async function TribeMapPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const [tribes, squads, canManage] = await Promise.all([
    listTribes(ctx.supabase),
    listSquadsLite(ctx.supabase),
    hasPermission(ctx.supabase, "squad.manage"),
  ]);
  return <TribeMap tribes={tribes} squads={squads} canManage={canManage} />;
}
