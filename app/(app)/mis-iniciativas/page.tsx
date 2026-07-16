import { getContext } from "@/lib/auth/context";
import { getMyMemberId } from "@/lib/incidents/queries";
import { getMyInitiatives } from "@/lib/squad-member/queries";
import { MyInitiativesView } from "@/components/squad-member/my-initiatives";

// Iniciativas (proyectos) de MIS squads. Sin caso de negocio financiero, sin WSJF global, sin hilo
// del cliente (§5). Solo lectura de avance propio/equipo.
export default async function MisIniciativasPage() {
  const ctx = await getContext();
  if (!ctx) return null;
  const memberId = await getMyMemberId(ctx.supabase, ctx.accountId);
  const initiatives = memberId ? await getMyInitiatives(ctx.supabase, memberId) : [];
  return <MyInitiativesView initiatives={initiatives} linked={!!memberId} />;
}
