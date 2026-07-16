import { getContext } from "@/lib/auth/context";
import { getMyMemberId } from "@/lib/incidents/queries";
import { getMySquads, getMySquadDetail } from "@/lib/squad-member/queries";
import { MySquadView } from "@/components/squad-member/my-squad";

// "Mis squads": pertenencia, proposito y coordinacion, acotado a los squads de la persona (§4).
// Los maestros nuevos (objetivos, vinculo RC) degradan con estado vacio si no estan cargados.
export default async function MiSquadPage({ searchParams }: { searchParams: Promise<{ squad?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx) return null;
  const memberId = await getMyMemberId(ctx.supabase, ctx.accountId);
  const squads = memberId ? await getMySquads(ctx.supabase, memberId) : [];
  const squadId = (sp.squad && squads.some((s) => s.squad_id === sp.squad)) ? sp.squad : (squads[0]?.squad_id ?? null);
  const detail = memberId && squadId ? await getMySquadDetail(ctx.supabase, memberId, squadId) : null;
  return <MySquadView squads={squads} detail={detail} activeSquadId={squadId} linked={!!memberId} />;
}
